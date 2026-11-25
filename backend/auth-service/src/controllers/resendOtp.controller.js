/**
 * resendOtp.controller.js
 *
 * POST /api/auth/resend-otp
 * Revokes the existing OTP challenge and re-issues a fresh one.
 *
 * Challenge identifier is read from the HttpOnly otp_challenge_id cookie.
 *
 * Supported flows:
 *   - RISK_CHALLENGE   + NEW_SIGNUP
 *   - EMAIL_VERIF      + NEW_SIGNUP
 *   - EMAIL_VERIF      + ACCOUNT_ACTIVATION
 *   - ACCOUNT_RECOVERY + ACCOUNT_RECOVERY
 *
 * The API Gateway applies request rate limits; this endpoint also enforces
 * a per-challenge resend cooldown (60 s).
 */

import prisma from '../lib/db.js'
import { sendMail } from '../lib/email.js'

import {
  generateOtp,
  hashOtp,
  OTP_TTL_MS,
  setOtpChallengeCookie,
  clearOtpChallengeCookie,
  clearRiskEvalCookie,
} from '../lib/auth.helpers.js'

const RESEND_COOLDOWN_MS = 60 * 1_000 // 60 seconds

async function findCurrentChallenge(challenge) {
  return prisma.otpChallenge.findFirst({
    where: {
      userId: challenge.userId,
      emailNormalized: challenge.emailNormalized,
      purpose: challenge.purpose,
      originatingFlow: challenge.originatingFlow,
      originatingFlowIntent: challenge.originatingFlowIntent,
      usedAt: null,
      revokedAt: null,
    },
    orderBy: { createdAt: 'desc' },
  })
}

export async function resendOtp(req, res) {
  try {
    // --------------------------------------------------------
    // 1. VALIDATE REQUEST
    // --------------------------------------------------------

    const challengeId =
      typeof req.cookies?.otp_challenge_id === 'string'
        ? req.cookies.otp_challenge_id.trim()
        : ''

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(challengeId)) {
      return res.status(400).json({
        success: false,
        message: 'A valid OTP challenge cookie is required.',
      })
    }

    const now = new Date()

    // --------------------------------------------------------
    // 2. RETRIEVE EXISTING CHALLENGE
    // --------------------------------------------------------

    let challenge = await prisma.otpChallenge.findUnique({
      where: { id: challengeId },
    })

    if (!challenge) {
      return res.status(404).json({
        success: false,
        message: 'OTP challenge not found.',
      })
    }

    // --------------------------------------------------------
    // 3. REJECT IF ALREADY TERMINAL
    // --------------------------------------------------------

    if (challenge.usedAt) {
      return res.status(400).json({
        success: false,
        message: 'This OTP has already been used.',
      })
    }

    if (challenge.revokedAt) {
      // A previous resend may have committed but its Set-Cookie response may
      // not have reached the browser. Recover the current challenge for this
      // same flow and replace the stale cookie before continuing.
      const currentChallenge = await findCurrentChallenge(challenge)

      if (!currentChallenge) {
        return res.status(400).json({
          success: false,
          message: 'This OTP challenge has been revoked. Start sign-up again to request a new code.',
        })
      }

      challenge = currentChallenge
      setOtpChallengeCookie(res, currentChallenge.id)
    }

    // --------------------------------------------------------
    // 4. RESOLVE FLOW TYPE
    // --------------------------------------------------------

    const { purpose, originatingFlow, originatingFlowIntent } = challenge

    const isRiskChallenge =
      purpose === 'RISK_CHALLENGE' &&
      originatingFlow === 'NEW_SIGNUP' &&
      originatingFlowIntent === 'CREDENTIALS_SIGNUP'

    const isNewSignupEmailVerification =
      purpose === 'EMAIL_VERIF' &&
      originatingFlow === 'NEW_SIGNUP' &&
      originatingFlowIntent === 'CREDENTIALS_SIGNUP'

    const isAccountActivation =
      purpose === 'EMAIL_VERIF' &&
      originatingFlow === 'ACCOUNT_ACTIVATION' &&
      originatingFlowIntent === 'CREDENTIALS_SIGNUP'

    const isAccountRecovery =
      purpose === 'ACCOUNT_RECOVERY' &&
      originatingFlow === 'ACCOUNT_RECOVERY' &&
      originatingFlowIntent === 'CREDENTIALS_SIGNUP'

    const isAccountRecoveryMfa =
      purpose === 'STEP_UP_MFA' &&
      originatingFlow === 'ACCOUNT_RECOVERY' &&
      originatingFlowIntent === 'CREDENTIALS_SIGNIN'

    if (
      !isRiskChallenge &&
      !isNewSignupEmailVerification &&
      !isAccountActivation &&
      !isAccountRecovery &&
      !isAccountRecoveryMfa
    ) {
      return res.status(400).json({
        success: false,
        message: 'Resend is not supported for this OTP flow.',
      })
    }

    if (isRiskChallenge && challenge.isLocked) {
      clearOtpChallengeCookie(res)
      clearRiskEvalCookie(res)
      return res.status(409).json({
        success: false,
        action: 'RESTART_SIGNUP',
        nextStep: 'SIGNUP',
        message: 'This security challenge is locked. Start sign-up again to continue.',
      })
    }

    // --------------------------------------------------------
    // 5. RETRIEVE ASSOCIATED USER (non-risk flows)
    // --------------------------------------------------------

    const user = challenge.userId
      ? await prisma.user.findUnique({ where: { id: challenge.userId } })
      : null

    if (!isRiskChallenge && (!user || user.email !== challenge.emailNormalized)) {
      return res.status(404).json({
        success: false,
        message: 'Associated account not found.',
      })
    }

    // --------------------------------------------------------
    // 6. VALIDATE ACCOUNT STATE (email-verif / recovery flows)
    // --------------------------------------------------------

    if (isNewSignupEmailVerification || isAccountActivation) {
      if (user.accountStatus !== 'PENDING' || user.isVerified === true) {
        return res.status(403).json({
          success: false,
          message: 'Account is not eligible for OTP resend.',
        })
      }
    }

    if (isAccountRecovery || isAccountRecoveryMfa) {
      const cutoff = user.deletedAt
        ? new Date(user.deletedAt.getTime() + 90 * 86_400_000)
        : null

      if (user.accountStatus !== 'DELETED' || !user.isVerified || !cutoff || now >= cutoff) {
        return res.status(403).json({
          success: false,
          message: 'Account is not eligible for OTP resend.',
        })
      }
    }

    // --------------------------------------------------------
    // 7. COOLDOWN CHECK — prevent OTP flood
    // --------------------------------------------------------

    const sinceCreated = now.getTime() - challenge.createdAt.getTime()

    if (sinceCreated < RESEND_COOLDOWN_MS) {
      const waitSec = Math.ceil((RESEND_COOLDOWN_MS - sinceCreated) / 1_000)
      return res.status(429).json({
        success:        false,
        message:        `Please wait ${waitSec} seconds before requesting a new OTP.`,
        retryAfterSecs: waitSec,
      })
    }

    // --------------------------------------------------------
    // 8. REVOKE OLD + CREATE FRESH CHALLENGE (atomic)
    // --------------------------------------------------------

    const newOtp = generateOtp()

    const newChallenge = await prisma.$transaction(async (tx) => {
      // Claim this challenge once so two concurrent resend requests cannot
      // both mint valid OTPs from the same cookie.
      const revoked = await tx.otpChallenge.updateMany({
        where: {
          id:        challenge.id,
          usedAt:    null,
          revokedAt: null,
        },
        data:  { revokedAt: now },
      })
      if (revoked.count !== 1) throw new Error('OTP_CHALLENGE_CHANGED')

      // If this was a risk challenge, mark the linked risk evaluation as failed
      // so it cannot be reused if the client somehow retains it.
      const newChallenge = await tx.otpChallenge.create({
        data: {
          userId:                challenge.userId,
          emailNormalized:       challenge.emailNormalized,
          purpose,
          originatingFlow,
          originatingFlowIntent,
          otpHash:               hashOtp(newOtp),
          requestIp:             challenge.requestIp,
          deviceFingerprintHash: challenge.deviceFingerprintHash,
          expiresAt:             new Date(now.getTime() + OTP_TTL_MS),
        },
      })

      if (isRiskChallenge) {
        await tx.signupRiskEvaluation.updateMany({
          where: { riskOtpChallengeId: challenge.id, riskOtpPassed: null, userId: null },
          data:  { riskOtpChallengeId: newChallenge.id },
        })
      }

      return newChallenge
    })

    // --------------------------------------------------------
    // 9. SEND NEW OTP EMAIL
    // --------------------------------------------------------

    const toEmail = challenge.emailNormalized

    const subjects = {
      RISK_CHALLENGE:  'Verify Your Rydex Sign-Up',
      EMAIL_VERIF_NEW: 'Verify Your Rydex Account',
      EMAIL_VERIF_ACT: 'Activate Your Rydex Account',
      ACCOUNT_RECOVERY:'Rydex Account Recovery',
    }

    const bodies = {
      RISK_CHALLENGE: `
        <div style="font-family:Arial,sans-serif">
          <h2>Rydex Security Verification</h2>
          <p>Your new verification OTP is below.</p>
          <h1>${newOtp}</h1>
          <p>This OTP expires in 10 minutes.</p>
        </div>`,

      EMAIL_VERIF_NEW: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
          <h2>Verify Your Rydex Account</h2>
          <p>Use the OTP below to verify your email address.</p>
          <h1 style="background:#f4f4f4;padding:10px;text-align:center;letter-spacing:5px">
            ${newOtp}
          </h1>
          <p>This OTP expires in 10 minutes.</p>
        </div>`,

      EMAIL_VERIF_ACT: `
        <div style="font-family:Arial,sans-serif">
          <h2>Activate Your Rydex Account</h2>
          <p>Use the following OTP to verify your email.</p>
          <h1>${newOtp}</h1>
          <p>This OTP expires in 10 minutes.</p>
        </div>`,

      ACCOUNT_RECOVERY: `
        <div style="font-family:Arial,sans-serif">
          <h2>Rydex Account Recovery</h2>
          <p>Use this OTP to verify account ownership.</p>
          <h1>${newOtp}</h1>
          <p>This OTP expires in 10 minutes.</p>
        </div>`,
    }

    let subjectKey, bodyKey
    if (isRiskChallenge)             { subjectKey = 'RISK_CHALLENGE';  bodyKey = 'RISK_CHALLENGE'  }
    else if (isNewSignupEmailVerification) { subjectKey = 'EMAIL_VERIF_NEW'; bodyKey = 'EMAIL_VERIF_NEW' }
    else if (isAccountActivation)    { subjectKey = 'EMAIL_VERIF_ACT'; bodyKey = 'EMAIL_VERIF_ACT' }
    else                              { subjectKey = 'ACCOUNT_RECOVERY';bodyKey = 'ACCOUNT_RECOVERY'}

    // The DB has rotated the challenge, so update the browser cookie before
    // attempting delivery. If mail delivery fails, the browser can still
    // retry using the new challenge after the server-side cooldown.
    setOtpChallengeCookie(res, newChallenge.id)

    try {
      await sendMail(toEmail, subjects[subjectKey], bodies[bodyKey])
    } catch (error) {
      console.error('[auth-service] resend-otp email delivery failed:', error)
      return res.status(502).json({
        success: false,
        message: 'The OTP was refreshed, but email delivery failed. Please wait before requesting another code.',
        retryAfterSecs: Math.ceil(RESEND_COOLDOWN_MS / 1_000),
      })
    }

    // --------------------------------------------------------
    // 10. RESPOND
    // --------------------------------------------------------

    return res.status(200).json({
      success:        true,
      message:        'A new OTP has been sent to your email.',
      nextStep:       isRiskChallenge
        ? 'RISK_OTP_VERIFICATION'
        : isAccountRecoveryMfa
          ? 'ACCOUNT_RECOVERY_MFA_VERIFICATION'
          : isAccountRecovery
          ? 'ACCOUNT_RECOVERY_VERIFICATION'
          : 'EMAIL_VERIFICATION',
    })

  } catch (error) {
    if (error.message === 'OTP_CHALLENGE_CHANGED') {
      return res.status(409).json({
        success: false,
        message: 'This OTP challenge changed. Use the latest code or restart sign-up.',
      })
    }
    console.error('[auth-service] resend-otp failed:', error)
    return res.status(500).json({
      success: false,
      message: 'Failed to resend OTP. Please try again.',
    })
  }
}
