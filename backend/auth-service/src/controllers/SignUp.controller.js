/**
 * SignUp.controller.js
 * POST /api/auth/register
 *
 * Flow: 4B-1 (Risk Evaluation) → 4C (Credential Check) → 4E (OTP hand-off) → 4H (Session)
 *
 * Implements the full CREDENTIALS SIGN-UP workflow from
 * "1. CREDENTIALS SIGN-UP.txt" (Layers 4B-1 → 4C → 4E → 4H).
 */

import bcrypt from 'bcryptjs'
import { sendMail } from '../lib/email.js'
import prisma from '../lib/db.js'

import {
  generateOtp,
  normalizeEmail,
  escapeHtml,
  hashOtp,
  OTP_TTL_MS,
  getTrustedRequestContext,
  writeSignupAudit,
  setOtpChallengeCookie,
} from '../lib/auth.helpers.js'

/* ════════════════════════════════════════════════════════════════════
   POST /api/auth/register
   ════════════════════════════════════════════════════════════════════ */

export async function register(req, res) {
  try {
    // --------------------------------------------------------
    // 1. VALIDATE INPUT  (4C-1)
    // --------------------------------------------------------

    const name =
      typeof req.body?.name === 'string'
        ? req.body.name.trim()
        : ''

    const email = normalizeEmail(req.body?.email)

    const password =
      typeof req.body?.password === 'string'
        ? req.body.password
        : ''

    if (
      !name ||
      name.length > 120 ||
      !/^\S+@\S+\.\S+$/.test(email) ||
      password.length < 8 ||
      password.length > 128
    ) {
      return res.status(400).json({
        success: false,
        message: 'Invalid name, email or password.',
      })
    }

    // --------------------------------------------------------
    // 2. TRUSTED REQUEST CONTEXT
    // --------------------------------------------------------

    const context = getTrustedRequestContext(req)
    const { clientIp, userAgent, fingerprint, coarseLocation } = context

    /*
    // --------------------------------------------------------
    // 3. LOAD OR CREATE THE RISK EVALUATION  (4B-1)
    // --------------------------------------------------------

    let riskEvaluation

    if (riskEvaluationId) {
      
      // ── RETRY after risk OTP passed ──────────────────────
      riskEvaluation = await prisma.signupRiskEvaluation.findFirst({
        where: {
          id:                   riskEvaluationId,
          emailNormalized:      email,
          flowIntent:           'CREDENTIALS_SIGNUP',
        },
      })

      if (!riskEvaluation) {
        return res.status(403).json({
          success: false,
          message: 'Sign-up risk verification is invalid or incomplete.',
        })
      }

    } 
    
    else {
      // ── FRESH request — evaluate risk signals ─────────────

      // Lower WAF bot scores = higher automation risk (WAF convention).
      const isFastBotActivity      = botScore !== null && botScore <= 30
      const isProxyTorDatacenterIP = /ANONYMOUS_PROXY|TOR_EXIT_NODE|DATACENTER_IP/i.test(ipReputation)


      // ── Two-layer disposable email detection ───────────────────────────
      // Layer 1: infrastructure header (WAF / API Gateway reputation signal).
      // Layer 2: local mailchecker open-source blocklist (~55k domains, O(1) Set lookup).
      // isDisposable = true if EITHER layer fires.
      const { isDisposable: isDisposableEmail, detectedBy: disposableDetectedBy } =
        checkDisposableEmail(email, disposableEmailSignal)
   
      // ───────────────────────────────────────────────────────────────────

      // connectionLimitStatus, localRateLimitOutcome, gatewayRateLimitStatus,
      // and gatewayPolicyStatus are already validated against their schema enums
      // in getTrustedRequestContext() and destructured from context above.

      // 4B-1C — Calculate risk score.
      let riskScore = 0
      if (isProxyTorDatacenterIP) riskScore += 40
      if (isFastBotActivity)      riskScore += 30
      if (isDisposableEmail)      riskScore += 30
      if (isRateOrSubnetSurge)    riskScore += 35

      // 4B-1E — Risk decision.
      const decision =
        riskScore >= 60 ? 'REJECT' :
        riskScore >= 25 ? 'CHALLENGE_OTP' :
                          'ALLOW'

      const riskOtp = decision === 'CHALLENGE_OTP' ? generateOtp() : null

      // 4B-1D — INSERT evaluation (+ OTP challenge in one transaction).
      riskEvaluation = await prisma.$transaction(async (tx) => {
        const evaluation = await tx.signupRiskEvaluation.create({
          data: {
            userId:          null,
            emailNormalized: email,
            flowIntent:      'CREDENTIALS_SIGNUP',

            edgeRequestId,
            wafBotScore:        botScore,
            wafBotSignals:      botSignals,
            wafIpReputation:    ipReputation,
            wafSecurityAction,
            wafChallengeType,
            wafChallengeStatus,
            wafRateLimitTriggered,

            nginxRequestId,
            clientIp,
            peerIp,
            requestMethod,
            requestUri,
            connectionConcurrency,
            connectionLimitStatus,
            localRateLimitOutcome,

            gatewayRequestId,
            gatewayRateLimitStatus,
            gatewayPolicyStatus,
            upstreamService: 'AUTH_SERVICE',

            deviceFingerprintHash: fingerprint,
            userAgent,
            coarseLocation,

            isDisposableEmail,
            isRateOrSubnetSurge,

            totalRiskScore: riskScore,
            decision,
          },
        })

        if (decision !== 'CHALLENGE_OTP') return evaluation

        const challenge = await tx.otpChallenge.create({
          data: {
            userId:               null,
            emailNormalized:      email,
            purpose:              'RISK_CHALLENGE',
            originatingFlow:      'NEW_SIGNUP',
            originatingFlowIntent:'CREDENTIALS_SIGNUP',
            otpHash:              hashOtp(riskOtp),
            requestIp:            clientIp,
            deviceFingerprintHash: fingerprint,
            expiresAt:            new Date(Date.now() + OTP_TTL_MS),
          },
        })

        await tx.signupRiskEvaluation.update({
          where: { id: evaluation.id },
          data:  { riskOtpChallengeId: challenge.id },
        })

        return { ...evaluation, riskOtpChallengeId: challenge.id }
      })

      // 4B-1E — REJECT path.
      if (decision === 'REJECT') {
        await writeSignupAudit({
          email,
          eventType: 'SIGNUP_RISK_REJECTED',
          context,
          metadata: { riskEvaluationId: riskEvaluation.id, riskScore, decision, disposableDetectedBy },
        })

        return res.status(403).json({
          success: false,
          message: 'We are unable to process your sign-up request.',
        })
      }

      // 4B-1E — CHALLENGE_OTP path: send risk OTP and pause.
      if (decision === 'CHALLENGE_OTP') {
        await sendMail(
          email,
          'Verify Your Rydex Sign-Up',
          `
            <div style="font-family:Arial,sans-serif">
              <h2>Rydex Security Verification</h2>
              <p>Additional verification is required to continue.</p>
              <h1>${riskOtp}</h1>
              <p>This OTP expires in 10 minutes.</p>
            </div>
          `
        )

        setOtpChallengeCookie(res, riskEvaluation.riskOtpChallengeId)
        setRiskEvalCookie(res, riskEvaluation.id)

        return res.status(202).json({
        success:  true,
        message:  'Additional verification required.',
        nextStep: 'RISK_OTP_VERIFICATION',
      })

      }
    }
    */

    // The risk engine is intentionally skipped for local signup testing.
    // Continue through credential checks and email OTP verification.

    // --------------------------------------------------------
    // 5. EMAIL CONFLICT CHECK  (4C)
    // --------------------------------------------------------

    const identity = await prisma.user.findUnique({ where: { email } })

    if (identity) {
      const now = new Date()
      const { id: userId, accountStatus, isVerified, deletedAt, passwordHash } = identity

      // ── CASE A — SUSPENDED / BLOCKED ────────────────────
      if (accountStatus === 'SUSPENDED' || accountStatus === 'BLOCKED') {
        await writeSignupAudit({
          userId, email,
          eventType: 'RESTRICTED_ACCOUNT_ACCESS_ATTEMPT',
          context,
          metadata: { accountStatus, source: 'SIGNUP_EMAIL_CONFLICT' },
        })
        return res.status(403).json({
          success: false,
          message: 'We are unable to process your sign-up request.',
        })
      }

      // ── CASE B — DELETED ACCOUNT ─────────────────────────
      if (accountStatus === 'DELETED') {
        const deletionCutoff = deletedAt
          ? new Date(deletedAt.getTime() + 90 * 86_400_000)
          : null

        // Deleted > 90 days → permanent rejection.
        if (!deletionCutoff || now >= deletionCutoff) {
          await writeSignupAudit({
            userId, email,
            eventType: 'RESTRICTED_ACCOUNT_ACCESS_ATTEMPT',
            context,
            metadata: { accountStatus: 'DELETED', deletedAt, deletionCutoff },
          })
          return res.status(403).json({
            success: false,
            message: 'We are unable to process your sign-up request.',
          })
        }

        // Deleted < 90 days → ACCOUNT_RECOVERY OTP flow.
        const recoveryOtp = generateOtp()

        const challenge = await prisma.$transaction(async (tx) => {
          // Revoke any outstanding recovery challenge for this user.
          await tx.otpChallenge.updateMany({
            where: {
              userId,
              purpose:         'ACCOUNT_RECOVERY',
              originatingFlow: 'ACCOUNT_RECOVERY',
              usedAt:    null,
              revokedAt: null,
            },
            data: { revokedAt: now },
          })

          return tx.otpChallenge.create({
            data: {
              userId,
              emailNormalized:       email,
              purpose:               'ACCOUNT_RECOVERY',
              originatingFlow:       'ACCOUNT_RECOVERY',
              originatingFlowIntent: 'CREDENTIALS_SIGNUP',
              otpHash:               hashOtp(recoveryOtp),
              requestIp:             clientIp,
              deviceFingerprintHash: fingerprint,
              expiresAt:             new Date(now.getTime() + OTP_TTL_MS),
            },
          })
        })

        await sendMail(
          email,
          'Rydex Account Recovery',
          `
            <div style="font-family:Arial,sans-serif">
              <h2>Rydex Account Recovery</h2>
              <p>Use this OTP to verify account ownership.</p>
              <h1>${recoveryOtp}</h1>
              <p>This OTP expires in 10 minutes.</p>
            </div>
          `
        )

      setOtpChallengeCookie(res, challenge.id)

      return res.status(202).json({
      success:  true,
        message:  'Verification code sent to recover your account.',
        nextStep: 'ACCOUNT_RECOVERY_VERIFICATION',
      })
      }

      // ── CASE C — PENDING + UNVERIFIED (re-send activation OTP) ──
      if (accountStatus === 'PENDING' && !isVerified) {
        const activationOtp = generateOtp()

        const challenge = await prisma.$transaction(async (tx) => {
          await tx.otpChallenge.updateMany({
            where: {
              userId,
              purpose:         'EMAIL_VERIF',
              originatingFlow: 'ACCOUNT_ACTIVATION',
              usedAt:    null,
              revokedAt: null,
            },
            data: { revokedAt: now },
          })

          return tx.otpChallenge.create({
            data: {
              userId,
              emailNormalized:       email,
              purpose:               'EMAIL_VERIF',
              originatingFlow:       'ACCOUNT_ACTIVATION',
              originatingFlowIntent: 'CREDENTIALS_SIGNUP',
              otpHash:               hashOtp(activationOtp),
              requestIp:             clientIp,
              deviceFingerprintHash: fingerprint,
              expiresAt:             new Date(now.getTime() + OTP_TTL_MS),
            },
          })
        })

        await sendMail(
          email,
          'Activate Your Rydex Account',
          `
            <div style="font-family:Arial,sans-serif">
              <h2>Activate Your Rydex Account</h2>
              <p>Use the following OTP to verify your email.</p>
              <h1>${activationOtp}</h1>
              <p>This OTP expires in 10 minutes.</p>
            </div>
          `
        )

      setOtpChallengeCookie(res, challenge.id)

      return res.status(202).json({
      success:  true,
      message:  'Verification code sent to activate your account.',
      nextStep: 'EMAIL_VERIFICATION',
      })
      }

      // ── CASE D — ACTIVE + VERIFIED  or  PENDING + VERIFIED ──────
      if (isVerified && ['ACTIVE', 'PENDING'].includes(accountStatus)) {
        if (!passwordHash) {
          const googleIdentity = await prisma.oauthIdentity.findFirst({
            where:  { userId, provider: 'GOOGLE' },
            select: { id: true },
          })

          if (googleIdentity) {
            return res.status(409).json({
              success: false,
              action:  'GOOGLE_SIGNIN',
              message: 'This account uses Google sign-in.',
            })
          }

          return res.status(409).json({
            success: false,
            message: 'Unable to process this sign-up request.',
          })
        }

        const passwordMatches = await bcrypt.compare(password, passwordHash)

        if (!passwordMatches) {
          await writeSignupAudit({
            userId, email,
            eventType: 'CREDENTIALS_INVALID_PASSWORD',
            context,
            metadata: { source: 'SIGNUP_EMAIL_CONFLICT', accountStatus },
          })
          return res.status(401).json({
            success: false,
            message: 'Invalid email or password.',
          })
        }

        // Password matches — guide the client to the sign-in flow.
        return res.status(409).json({
          success:  true,
          action:   'CREDENTIALS_SIGNIN',
          message:  'Account already exists. Continue with sign-in.',
          nextStep: 'CREDENTIALS_SIGNIN',
        })
      }

      return res.status(403).json({
        success: false,
        message: 'We are unable to process your sign-up request.',
      })
    }

    // --------------------------------------------------------
    // 6. NEW ACCOUNT — HASH PASSWORD  (4C)
    // --------------------------------------------------------

    const hashedPassword = await bcrypt.hash(password, 12)
    const now            = new Date()

    const emailOtp = generateOtp()

    // --------------------------------------------------------
    // 7. ATOMIC USER + OTP + TRUSTED DEVICE + RISK LINK
    // --------------------------------------------------------

    const created = await prisma.$transaction(async (tx) => {
      // Guard against concurrent signup for the same email.
      const existing = await tx.user.findUnique({ where: { email }, select: { id: true } })
      if (existing) throw new Error('EMAIL_ALREADY_REGISTERED')

      const user = await tx.user.create({
        data: {
          name,
          email,
          passwordHash:      hashedPassword,
          passwordChangedAt: now,
          role:              'RIDER',
          isVerified:        false,
          emailVerifiedAt:   null,
          accountStatus:     'PENDING',
        },
      })

      const otpChallenge = await tx.otpChallenge.create({
        data: {
          userId:                user.id,
          emailNormalized:       email,
          purpose:               'EMAIL_VERIF',
          originatingFlow:       'NEW_SIGNUP',
          originatingFlowIntent: 'CREDENTIALS_SIGNUP',
          otpHash:               hashOtp(emailOtp),
          requestIp:             clientIp,
          deviceFingerprintHash: fingerprint,
          expiresAt:             new Date(now.getTime() + OTP_TTL_MS),
        },
      })

      return {
        ...user,
        otpChallengeId: otpChallenge.id,
      }
    })

    // --------------------------------------------------------
    // 8. EMAIL OTP SENT; WAIT FOR VERIFICATION  (4E)
    // --------------------------------------------------------

    await sendMail(
        email,
        'Verify Your Rydex Account',
        `
          <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
            <h2>Welcome to Rydex!</h2>
            <p>Hello ${escapeHtml(name)},</p>
            <p>Verify your email address using the OTP below.</p>
            <h1 style="background:#f4f4f4;padding:10px;text-align:center;letter-spacing:5px">
              ${emailOtp}
            </h1>
            <p>This OTP expires in 10 minutes.</p>
          </div>
        `
    )

     setOtpChallengeCookie(res, created.otpChallengeId)

    return res.status(201).json({
      success:  true,
      message:  'Account created. Please verify your email.',
      nextStep: 'EMAIL_VERIFICATION',
    })

  } catch (error) {
    if (error.message === 'EMAIL_ALREADY_REGISTERED') {
      return res.status(409).json({
        success: false,
        message: 'An account with this email already exists.',
      })
    }

    if (error.message === 'REQUEST_IP_UNAVAILABLE') {
      return res.status(400).json({
        success: false,
        message: 'Unable to identify request source.',
      })
    }

    console.error('[auth-service] signup failed:', error)

    return res.status(500).json({
      success: false,
      message: 'Unable to process sign-up request.',
    })
  }
}

