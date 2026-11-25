/**
 * POST /api/auth/signin
 * Credential sign-in entry point (workflow 4D -> 4E/4G -> 4H).
 */

import bcrypt from 'bcryptjs'
import { sendMail } from '../lib/email.js'
import prisma from '../lib/db.js'
import {
  createSessionForUser,
  generateOtp,
  getTrustedRequestContext,
  hashOtp,
  normalizeEmail,
  OTP_TTL_MS,
  setOtpChallengeCookie,
  writeAuthAudit,
} from '../lib/auth.helpers.js'

const RECOVERY_WINDOW_MS = 90 * 24 * 60 * 60 * 1_000
const GENERIC_CREDENTIAL_ERROR = 'Invalid email or password.'

// One cached, valid bcrypt hash keeps unknown-email requests on a password
// verification path without storing a dummy credential in the database.
let dummyHashPromise
function verifyDummyPassword(password) {
  dummyHashPromise ??= bcrypt.hash('rydex-dummy-password-never-valid', 12)
  return dummyHashPromise.then((hash) => bcrypt.compare(password, hash))
}

async function createChallenge({ user, email, purpose, origin, context, now, res }) {
  const otp = generateOtp()
  const challenge = await prisma.$transaction(async (tx) => {
    await tx.otpChallenge.updateMany({
      where: {
        userId: user.id,
        purpose,
        ...(purpose === 'STEP_UP_MFA' ? { originatingFlow: origin } : {}),
        usedAt: null,
        revokedAt: null,
        isLocked: false,
        expiresAt: { gt: now },
      },
      data: { revokedAt: now },
    })

    return tx.otpChallenge.create({
      data: {
        userId: user.id,
        emailNormalized: email,
        purpose,
        originatingFlow: origin,
        originatingFlowIntent: 'CREDENTIALS_SIGNIN',
        otpHash: hashOtp(otp),
        requestIp: context.clientIp,
        deviceFingerprintHash: context.fingerprint,
        expiresAt: new Date(now.getTime() + OTP_TTL_MS),
      },
    })
  })
  setOtpChallengeCookie(res, challenge.id)
  return { challenge, otp }
}

async function sendChallengeEmail(email, otp, purpose, isAccountRecovery = false) {
  const emailVerification = purpose === 'EMAIL_VERIF'
  await sendMail(
    email,
    emailVerification
      ? 'Activate Your Rydex Account'
      : isAccountRecovery
        ? 'Rydex Account Recovery Verification'
        : 'Rydex Sign-In Verification',
    `<div style="font-family:Arial,sans-serif;max-width:600px;margin:auto">
      <h2>${emailVerification ? 'Verify Your Rydex Account' : isAccountRecovery ? 'Verify Account Recovery' : 'New Device Sign-In Verification'}</h2>
      <p>${emailVerification ? 'Use this code to verify your email address.' : isAccountRecovery ? 'Use this code to confirm you are restoring your account.' : 'Use this code to confirm it is you signing in from a new device.'}</p>
      <h1 style="background:#f4f4f4;padding:10px;text-align:center;letter-spacing:5px">${otp}</h1>
      <p>This code expires in 10 minutes.</p>
    </div>`
  )
}

export async function signin(req, res) {
  const email = normalizeEmail(req.body?.email)
  const password = typeof req.body?.password === 'string' ? req.body.password : ''

  if (!/^\S+@\S+\.\S+$/.test(email) || !password || password.length > 128) {
    return res.status(400).json({ success: false, message: 'Email and password are required.' })
  }

  try {
    const context = getTrustedRequestContext(req)
    const now = new Date()
    const user = await prisma.user.findUnique({
      where: { email },
      select: {
        id: true, name: true, email: true, role: true, passwordHash: true, isVerified: true,
        accountStatus: true, deletedAt: true, mfaLockedUntil: true, emailVerifiedAt: true,
      },
    })

    if (!user) {
      await verifyDummyPassword(password)
      return res.status(401).json({ success: false, message: GENERIC_CREDENTIAL_ERROR })
    }

    const restricted = ['SUSPENDED', 'BLOCKED'].includes(user.accountStatus)
    const deletedTooLong = user.accountStatus === 'DELETED' &&
      (!user.deletedAt || now.getTime() - user.deletedAt.getTime() > RECOVERY_WINDOW_MS)
    if (restricted || deletedTooLong) {
      await writeAuthAudit({
        userId: user.id, email, eventType: 'RESTRICTED_ACCOUNT_ACCESS_ATTEMPT',
        flowIntent: 'CREDENTIALS_SIGNIN', context,
        metadata: { decision: 'REJECTED', account_status: user.accountStatus },
      })
      return res.status(403).json({ success: false, message: 'This account cannot sign in.' })
    }

    // Deleted accounts use the documented recovery branch. A matching active
    // trusted device acts as the schema's available same-device proxy.
    if (user.accountStatus === 'DELETED') {
      if (!user.isVerified) {
        return res.status(403).json({ success: false, message: 'This account cannot sign in.' })
      }

      if (!user.passwordHash) {
        const googleIdentity = await prisma.oauthIdentity.findFirst({
          where: { userId: user.id, provider: 'GOOGLE' },
          select: { id: true },
        })
        if (googleIdentity) {
          return res.status(409).json({
            success: false,
            message: 'This account uses Google sign-in.',
            action: 'GOOGLE_OAUTH_SIGNIN',
            nextStep: 'GOOGLE_OAUTH',
          })
        }
        await verifyDummyPassword(password)
        return res.status(401).json({ success: false, message: GENERIC_CREDENTIAL_ERROR })
      }

      let recoveryPasswordValid = false
      try {
        recoveryPasswordValid = await bcrypt.compare(password, user.passwordHash)
      } catch { /* malformed stored hash is treated as invalid */ }
      if (!recoveryPasswordValid) {
        await writeAuthAudit({
          userId: user.id,
          email,
          eventType: 'CREDENTIALS_INVALID_PASSWORD',
          flowIntent: 'CREDENTIALS_SIGNIN',
          context,
          metadata: { decision: 'REJECTED', account_status: 'DELETED' },
        })
        return res.status(401).json({ success: false, message: GENERIC_CREDENTIAL_ERROR })
      }

      const sameDevice = await prisma.trustedDevice.findUnique({
        where: { userId_deviceFingerprintHash: { userId: user.id, deviceFingerprintHash: context.fingerprint } },
      })
      if (sameDevice && !sameDevice.isRevoked && sameDevice.trustedUntil > now && user.isVerified) {
        const restored = await prisma.user.updateMany({
          where: { id: user.id, accountStatus: 'DELETED', deletedAt: { gte: new Date(now.getTime() - RECOVERY_WINDOW_MS) } },
          data: { accountStatus: 'ACTIVE', deletedAt: null, updatedAt: now },
        })
        if (restored.count === 1) {
          const auth = await createSessionForUser({ userId: user.id, deviceFingerprintHash: context.fingerprint, clientIp: context.clientIp, res })
          return res.status(200).json({ success: true, message: 'Signed in successfully.', accessToken: auth.accessToken, sessionId: auth.sessionId, userId: user.id, name: user.name, email: user.email, role: user.role, nextStep: 'AUTHENTICATED' })
        }
      }
      if (user.mfaLockedUntil && user.mfaLockedUntil > now) {
        return res.status(429).json({ success: false, message: 'Account recovery verification is temporarily locked.', retryAfterSecs: Math.ceil((user.mfaLockedUntil.getTime() - now.getTime()) / 1_000) })
      }
      const { otp } = await createChallenge({ user, email, purpose: 'STEP_UP_MFA', origin: 'ACCOUNT_RECOVERY', context, now, res })
      try {
        await sendChallengeEmail(email, otp, 'STEP_UP_MFA', true)
      } catch (error) {
        console.error('[auth-service] account recovery OTP email failed:', error)
        return res.status(502).json({ success: false, message: 'Verification was prepared, but email delivery failed. Please request a resend.', nextStep: 'ACCOUNT_RECOVERY_MFA_VERIFICATION' })
      }
      return res.status(202).json({ success: true, message: 'Account recovery verification code sent.', nextStep: 'ACCOUNT_RECOVERY_MFA_VERIFICATION' })
    }

    if (!['ACTIVE', 'PENDING'].includes(user.accountStatus)) {
      return res.status(403).json({ success: false, message: 'This account cannot sign in.' })
    }

    if (!user.passwordHash) {
      const googleIdentity = await prisma.oauthIdentity.findFirst({ where: { userId: user.id, provider: 'GOOGLE' }, select: { id: true } })
      if (googleIdentity) return res.status(409).json({ success: false, message: 'This account uses Google sign-in.', action: 'GOOGLE_OAUTH_SIGNIN', nextStep: 'GOOGLE_OAUTH' })
      await verifyDummyPassword(password)
      return res.status(401).json({ success: false, message: GENERIC_CREDENTIAL_ERROR })
    }

    let passwordValid = false
    try { passwordValid = await bcrypt.compare(password, user.passwordHash) } catch { /* malformed stored hash is treated as invalid */ }
    if (!passwordValid) {
      await writeAuthAudit({ userId: user.id, email, eventType: 'CREDENTIALS_INVALID_PASSWORD', flowIntent: 'CREDENTIALS_SIGNIN', context, metadata: { decision: 'REJECTED' } })
      return res.status(401).json({ success: false, message: GENERIC_CREDENTIAL_ERROR })
    }

    if (!user.isVerified) {
      const { otp } = await createChallenge({ user, email, purpose: 'EMAIL_VERIF', origin: 'ACCOUNT_ACTIVATION', context, now, res })
      try {
        await sendChallengeEmail(email, otp, 'EMAIL_VERIF')
      } catch (error) {
        console.error('[auth-service] sign-in email verification delivery failed:', error)
        return res.status(502).json({ success: false, message: 'Verification was prepared, but email delivery failed. Please request a resend.', nextStep: 'EMAIL_VERIFICATION' })
      }
      return res.status(202).json({ success: true, message: 'Please verify your email to finish signing in.', nextStep: 'EMAIL_VERIFICATION' })
    }

    const trusted = await prisma.trustedDevice.findUnique({
      where: { userId_deviceFingerprintHash: { userId: user.id, deviceFingerprintHash: context.fingerprint } },
    })
    if (trusted && !trusted.isRevoked && trusted.trustedUntil > now) {
      await prisma.trustedDevice.update({
        where: { id: trusted.id },
        data: { lastSeenAt: now, lastIp: context.clientIp, userAgent: context.userAgent, coarseLocation: context.coarseLocation },
      })
      const auth = await createSessionForUser({ userId: user.id, deviceFingerprintHash: context.fingerprint, clientIp: context.clientIp, res })
      return res.status(200).json({ success: true, message: 'Signed in successfully.', accessToken: auth.accessToken, sessionId: auth.sessionId, userId: user.id, name: user.name, email: user.email, role: user.role, nextStep: 'AUTHENTICATED' })
    }

    if (user.mfaLockedUntil && user.mfaLockedUntil > now) {
      return res.status(429).json({ success: false, message: 'Additional verification is temporarily locked.', retryAfterSecs: Math.ceil((user.mfaLockedUntil.getTime() - now.getTime()) / 1_000) })
    }
    const { otp } = await createChallenge({ user, email, purpose: 'STEP_UP_MFA', origin: 'EXISTING_SIGNIN', context, now, res })
    await writeAuthAudit({ userId: user.id, email, eventType: 'NEW_DEVICE_SIGNIN_DETECTED', flowIntent: 'CREDENTIALS_SIGNIN', context, metadata: { mfa_verified: false } })
    try {
      await sendChallengeEmail(email, otp, 'STEP_UP_MFA')
    } catch (error) {
      console.error('[auth-service] new-device sign-in OTP email failed:', error)
      return res.status(502).json({ success: false, message: 'Verification was prepared, but email delivery failed. Please request a resend.', nextStep: 'STEP_UP_MFA_VERIFICATION' })
    }
    return res.status(202).json({ success: true, message: 'New device detected. Enter the verification code sent to your email.', nextStep: 'STEP_UP_MFA_VERIFICATION' })
  } catch (error) {
    console.error('[auth-service] sign-in failed:', error)
    return res.status(500).json({ success: false, message: 'Sign-in failed. Please try again.' })
  }
}
