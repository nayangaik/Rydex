/**
 * verify.controller.js
 *
 * POST /api/auth/verify-otp   — consume an OTP and advance the flow
 *
 * Supported OTP flows (from CREDENTIALS SIGN-UP workflow):
 *   1. RISK_CHALLENGE   + NEW_SIGNUP          → risk gate passed; client retries /register
 *   2. EMAIL_VERIF      + NEW_SIGNUP          → new account email verified; session created
 *   3. EMAIL_VERIF      + ACCOUNT_ACTIVATION  → pending+unverified account activated
 *   4. ACCOUNT_RECOVERY + ACCOUNT_RECOVERY    → deleted account; MFA step follows
 */

import prisma from '../lib/db.js'

import {
  otpMatches,
  createSessionForUser,
  getTrustedUntil,
  setOtpChallengeCookie,
  clearOtpChallengeCookie,
  clearRiskEvalCookie,
} from '../lib/auth.helpers.js'

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

/* ════════════════════════════════════════════════════════════════════
   POST /api/auth/verify-otp
   4E — Unified Email OTP Verification Engine
   ════════════════════════════════════════════════════════════════════ */

export async function verifyOtp(req, res) {
  try {
    // --------------------------------------------------------
    // 1. VALIDATE REQUEST
    // --------------------------------------------------------

    const challengeId =
      typeof req.cookies?.otp_challenge_id === 'string'
        ? req.cookies.otp_challenge_id.trim()
        : ''

    const otp =
      typeof req.body?.otp === 'string'
        ? req.body.otp.trim()
        : ''

    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

    if (!uuidRegex.test(challengeId) || !/^\d{6}$/.test(otp)) {
      return res.status(400).json({
        success: false,
        message: 'A valid challenge ID and six-digit OTP are required.',
      })
    }

    const now = new Date()

    // --------------------------------------------------------
    // 2. RETRIEVE OTP CHALLENGE
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
    // 3. VALIDATE CHALLENGE LIFECYCLE
    // --------------------------------------------------------

    if (challenge.usedAt || challenge.isLocked) {
      return res.status(400).json({
        success: false,
        message: 'This OTP challenge is no longer valid.',
      })
    }

    if (challenge.revokedAt) {
      const currentChallenge = await findCurrentChallenge(challenge)
      if (!currentChallenge) {
        return res.status(400).json({
          success: false,
          message: 'This OTP challenge is no longer valid. Request a new OTP.',
        })
      }
      challenge = currentChallenge
      setOtpChallengeCookie(res, currentChallenge.id)
    }

    if (challenge.expiresAt <= now) {
      return res.status(400).json({
        success: false,
        message: 'OTP has expired. Request a new OTP.',
      })
    }

    if (challenge.attempts >= challenge.maxAttempts) {
      return res.status(429).json({
        success: false,
        message: 'Maximum OTP attempts exceeded.',
      })
    }

    // --------------------------------------------------------
    // 4. RESOLVE OTP PURPOSE AND ORIGINATING FLOW
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
        message: 'Unsupported OTP challenge flow.',
      })
    }

    // --------------------------------------------------------
    // 5. RETRIEVE ASSOCIATED USER
    // --------------------------------------------------------

    const user = challenge.userId
      ? await prisma.user.findUnique({ where: { id: challenge.userId } })
      : null

    // Risk OTP is always pre-user (userId must be null).
    if (isRiskChallenge && challenge.userId !== null) {
      return res.status(400).json({
        success: false,
        message: 'Invalid risk challenge context.',
      })
    }

    // All other flows require an associated user.
    if (!isRiskChallenge) {
      if (!user || user.email !== challenge.emailNormalized) {
        return res.status(404).json({
          success: false,
          message: 'Associated account not found.',
        })
      }
    }

    // --------------------------------------------------------
    // 6. VALIDATE ACCOUNT STATE
    // --------------------------------------------------------

    if (isNewSignupEmailVerification || isAccountActivation) {
      if (user.accountStatus !== 'PENDING' || user.isVerified === true) {
        return res.status(403).json({
          success: false,
          message: 'Account is not eligible for email verification.',
        })
      }
    }

    if (isAccountRecovery || isAccountRecoveryMfa) {
      const recoveryCutoff = user.deletedAt
        ? new Date(user.deletedAt.getTime() + 90 * 86_400_000)
        : null

      if (user.accountStatus !== 'DELETED' || !recoveryCutoff || now >= recoveryCutoff) {
        return res.status(403).json({
          success: false,
          message: 'Account is not eligible for recovery.',
        })
      }
    }

    // --------------------------------------------------------
    // 7. VERIFY OTP HASH
    // --------------------------------------------------------

    const isValidOtp = otpMatches(otp, challenge.otpHash)

    // --------------------------------------------------------
    // 8. INVALID OTP — INCREMENT ATTEMPTS / LOCK AT MAX
    // --------------------------------------------------------

    if (!isValidOtp) {
      const nextAttempts = challenge.attempts + 1
      const shouldLock   = nextAttempts >= challenge.maxAttempts

      const failureResult = await prisma.$transaction(async (tx) => {
        // Compare-and-update prevents concurrent over-writes.
        const updated = await tx.otpChallenge.updateMany({
          where: {
            id:        challenge.id,
            attempts:  challenge.attempts,
            usedAt:    null,
            revokedAt: null,
            isLocked:  false,
            expiresAt: { gt: now },
          },
          data: { attempts: { increment: 1 }, isLocked: shouldLock },
        })

        if (updated.count !== 1) return false

        if (shouldLock) {
          if (isRiskChallenge) {
            await tx.signupRiskEvaluation.updateMany({
              where: { riskOtpChallengeId: challenge.id, decision: 'CHALLENGE_OTP' },
              data:  { riskOtpPassed: false },
            })
          }

          await tx.authAuditLog.create({
            data: {
              userId:               challenge.userId,
              emailAttempted:       challenge.emailNormalized,
              eventType:            isRiskChallenge ? 'SIGNUP_RISK_OTP_FAILED' : 'OTP_MAX_ATTEMPTS_LOCKOUT',
              flowIntent:           'OTP_VERIFICATION',
              clientIp:             challenge.requestIp,
              deviceFingerprintHash: challenge.deviceFingerprintHash,
              userAgent:            req.get('user-agent') || 'unknown',
              metadata: {
                challengeId:  challenge.id,
                purpose,
                originatingFlow,
                attempts:    nextAttempts,
                maxAttempts: challenge.maxAttempts,
              },
            },
          })
        }

        return true
      })

      if (!failureResult) {
        return res.status(409).json({
          success: false,
          message: 'OTP challenge changed. Please retry.',
        })
      }

      if (shouldLock) {
        if (isRiskChallenge) {
          clearOtpChallengeCookie(res)
          clearRiskEvalCookie(res)
          return res.status(429).json({
            success: false,
            action: 'RESTART_SIGNUP',
            nextStep: 'SIGNUP',
            message: 'Maximum attempts reached. Start sign-up again to receive a new verification challenge.',
          })
        }

        return res.status(429).json({
          success: false,
          message: 'Maximum attempts reached. OTP challenge locked.',
        })
      }

      return res.status(400).json({
        success:           false,
        message:           'Invalid OTP.',
        attemptsRemaining: challenge.maxAttempts - nextAttempts,
      })
    }

    // --------------------------------------------------------
    // 9. VALID OTP — ATOMIC CONSUMPTION + FLOW ADVANCE
    // --------------------------------------------------------

    const result = await prisma.$transaction(async (tx) => {
      // 9A — Consume exactly once.
      const consumed = await tx.otpChallenge.updateMany({
        where: {
          id:        challenge.id,
          attempts:  challenge.attempts,
          usedAt:    null,
          revokedAt: null,
          isLocked:  false,
          expiresAt: { gt: now },
        },
        data: { usedAt: now },
      })

      if (consumed.count !== 1) throw new Error('OTP_CHALLENGE_ALREADY_CONSUMED')

      // ── CASE A — SIGN-UP RISK CHALLENGE ─────────────────
      if (isRiskChallenge) {
        const riskUpdate = await tx.signupRiskEvaluation.updateMany({
          where: {
            riskOtpChallengeId: challenge.id,
            decision:           'CHALLENGE_OTP',
            riskOtpPassed:      null,
            userId:             null,
          },
          data: { riskOtpPassed: true },
        })

        if (riskUpdate.count !== 1) throw new Error('RISK_EVALUATION_NOT_FOUND_OR_PROCESSED')

        return { action: 'RETRY_SIGNUP', userId: null }
      }

      // ── CASE B — NEW SIGN-UP / ACCOUNT ACTIVATION ───────
      if (isNewSignupEmailVerification || isAccountActivation) {
        const verified = await tx.user.updateMany({
          where: { id: user.id, accountStatus: 'PENDING', isVerified: false },
          data:  { isVerified: true, emailVerifiedAt: now },
        })

        if (verified.count !== 1) throw new Error('ACCOUNT_VERIFICATION_STATE_CHANGED')

        // Register device from the persisted challenge fingerprint, not client headers.
        await tx.trustedDevice.upsert({
          where: {
            userId_deviceFingerprintHash: {
              userId:                user.id,
              deviceFingerprintHash: challenge.deviceFingerprintHash,
            },
          },
          create: {
            userId:                user.id,
            deviceFingerprintHash: challenge.deviceFingerprintHash,
            userAgent:             req.get('user-agent') || 'unknown',
            lastIp:                challenge.requestIp,
            trustedUntil:          getTrustedUntil(now),
            isInitialSignupDevice: true,
            isRevoked:             false,
          },
          update: {
            userAgent:             req.get('user-agent') || 'unknown',
            lastIp:                challenge.requestIp,
            trustedUntil:          getTrustedUntil(now),
            isInitialSignupDevice: true,
            isRevoked:             false,
            lastSeenAt:            now,
          },
        })

        return {
          action:                isNewSignupEmailVerification ? 'INITIAL_AUTHENTICATION' : 'ACCOUNT_ACTIVATION',
          userId:                user.id,
          deviceFingerprintHash: challenge.deviceFingerprintHash,
          clientIp:              challenge.requestIp,
        }
      }

      // ── CASE C — DELETED ACCOUNT RECOVERY ───────────────
      if (isAccountRecovery) {
        // Re-check inside the transaction before committing.
        const freshUser = await tx.user.findUnique({ where: { id: user.id } })
        const cutoff    = freshUser?.deletedAt
          ? new Date(freshUser.deletedAt.getTime() + 90 * 86_400_000)
          : null

        if (!freshUser || !freshUser.isVerified || freshUser.accountStatus !== 'DELETED' || !cutoff || now >= cutoff) {
          throw new Error('ACCOUNT_NOT_ELIGIBLE_FOR_RECOVERY')
        }

        // Keep accountStatus = DELETED. Restore only after MFA passes.
        return { action: 'ACCOUNT_RECOVERY', userId: user.id }
      }

      if (isAccountRecoveryMfa) {
        const freshUser = await tx.user.findUnique({ where: { id: user.id } })
        const cutoff = freshUser?.deletedAt
          ? new Date(freshUser.deletedAt.getTime() + 90 * 86_400_000)
          : null

        if (!freshUser || !freshUser.isVerified || freshUser.accountStatus !== 'DELETED' || !cutoff || now >= cutoff) {
          throw new Error('ACCOUNT_NOT_ELIGIBLE_FOR_RECOVERY')
        }

        const restored = await tx.user.updateMany({
          where: {
            id: user.id,
            accountStatus: 'DELETED',
            deletedAt: { gte: new Date(now.getTime() - 90 * 86_400_000) },
          },
          data: { accountStatus: 'ACTIVE', deletedAt: null, updatedAt: now },
        })
        if (restored.count !== 1) throw new Error('ACCOUNT_NOT_ELIGIBLE_FOR_RECOVERY')

        await tx.trustedDevice.upsert({
          where: {
            userId_deviceFingerprintHash: {
              userId: user.id,
              deviceFingerprintHash: challenge.deviceFingerprintHash,
            },
          },
          create: {
            userId: user.id,
            deviceFingerprintHash: challenge.deviceFingerprintHash,
            userAgent: req.get('user-agent') || 'unknown',
            lastIp: challenge.requestIp,
            trustedUntil: getTrustedUntil(now),
            isInitialSignupDevice: false,
            isRevoked: false,
          },
          update: {
            userAgent: req.get('user-agent') || 'unknown',
            lastIp: challenge.requestIp,
            trustedUntil: getTrustedUntil(now),
            isRevoked: false,
            lastSeenAt: now,
          },
        })

        return {
          action: 'ACCOUNT_RECOVERY_AUTHENTICATION',
          userId: user.id,
          name: freshUser.name,
          email: freshUser.email,
          role: freshUser.role,
          deviceFingerprintHash: challenge.deviceFingerprintHash,
          clientIp: challenge.requestIp,
        }
      }

      throw new Error('UNSUPPORTED_OTP_ACTION')
    })

    // --------------------------------------------------------
    // 10. DISPATCH RESULT
    // --------------------------------------------------------

    // CASE A — Risk OTP passed; front-end must retry POST /register.
    if (result.action === 'RETRY_SIGNUP') {
      // The risk evaluation cookie remains for the required signup retry.
      clearOtpChallengeCookie(res)
      return res.status(200).json({
        success:  true,
        message:  'Risk verification passed. Retry sign-up.',
        nextStep: 'RETRY_SIGNUP',
      })
    }

    // CASE B — Email verified; create session (4H).
    if (result.action === 'INITIAL_AUTHENTICATION' || result.action === 'ACCOUNT_ACTIVATION') {
      const auth = await createSessionForUser({
        userId:               result.userId,
        deviceFingerprintHash: result.deviceFingerprintHash,
        clientIp:              result.clientIp,
        res,
      })

      clearOtpChallengeCookie(res)
      clearRiskEvalCookie(res)

      return res.status(200).json({
        success:     true,
        message:     'Email verified and authentication completed.',
        userId:      result.userId,
        accessToken: auth.accessToken,
        sessionId:   auth.sessionId,
        nextStep:    'AUTHENTICATED',
      })
    }

    if (result.action === 'ACCOUNT_RECOVERY_AUTHENTICATION') {
      const auth = await createSessionForUser({
        userId: result.userId,
        deviceFingerprintHash: result.deviceFingerprintHash,
        clientIp: result.clientIp,
        res,
      })

      clearOtpChallengeCookie(res)
      clearRiskEvalCookie(res)

      return res.status(200).json({
        success: true,
        message: 'Account recovered and signed in successfully.',
        userId: result.userId,
        name: result.name,
        email: result.email,
        role: result.role,
        accessToken: auth.accessToken,
        sessionId: auth.sessionId,
        nextStep: 'AUTHENTICATED',
      })
    }

    // CASE C — Recovery OTP consumed; MFA step follows.
    if (result.action === 'ACCOUNT_RECOVERY') {
      clearOtpChallengeCookie(res)
      return res.status(200).json({
        success:  true,
        message:  'Account recovery OTP verified successfully.',
        userId:   result.userId,
        nextStep: 'ACCOUNT_RECOVERY',
      })
    }

    return res.status(400).json({ success: false, message: 'Unsupported OTP action.' })

  } catch (error) {
    if (
      error.message === 'OTP_CHALLENGE_ALREADY_CONSUMED' ||
      error.message === 'RISK_EVALUATION_NOT_FOUND_OR_PROCESSED' ||
      error.message === 'ACCOUNT_VERIFICATION_STATE_CHANGED' ||
      error.message === 'ACCOUNT_NOT_ELIGIBLE_FOR_RECOVERY'
    ) {
      return res.status(409).json({
        success: false,
        message: 'OTP verification could not be completed. Please retry.',
      })
    }

    console.error('[auth-service] OTP verification failed:', error)
    return res.status(500).json({
      success: false,
      message: 'OTP verification failed. Please try again.',
    })
  }
}

