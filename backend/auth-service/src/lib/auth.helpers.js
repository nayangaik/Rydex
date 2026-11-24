/**
 * auth.helpers.js
 * Shared utilities used by SignUp.controller.js, verify.controller.js,
 * and resendOtp.controller.js.
 *
 * Keeps every file free of duplicate copies of the same logic.
 */

import jwt from 'jsonwebtoken'
import {
  createHash,
  createHmac,
  randomBytes,
  randomInt,
  randomUUID,
  timingSafeEqual,
} from 'node:crypto'
import prisma from './db.js'

/* ── OTP ────────────────────────────────────────────────────────── */

export function generateOtp() {
  return randomInt(100_000, 1_000_000).toString()
}

export function otpExpiry() {
  return new Date(Date.now() + 10 * 60 * 1_000) // 10 minutes
}

export const OTP_TTL_MS = 10 * 60 * 1_000


const AUTH_COOKIE_BASE = {
  httpOnly: true,
  secure:   process.env.NODE_ENV === 'production',
  sameSite: 'strict',
  path:     '/api/auth',
}

export function setOtpChallengeCookie(res, challengeId) {
  res.cookie('otp_challenge_id', challengeId, {
    ...AUTH_COOKIE_BASE,
    maxAge: OTP_TTL_MS, // 10 minutes
  })
}

export function clearOtpChallengeCookie(res) {
  res.clearCookie('otp_challenge_id', AUTH_COOKIE_BASE)
}

export function setRiskEvalCookie(res, riskEvaluationId) {
  res.cookie('risk_eval_id', riskEvaluationId, {
    ...AUTH_COOKIE_BASE,
    maxAge: OTP_TTL_MS, // 10 minutes
  })
}

export function clearRiskEvalCookie(res) {
  res.clearCookie('risk_eval_id', AUTH_COOKIE_BASE)
}

export function setRefreshTokenCookie(res, token, expiresAt) {
  const maxAge = Math.max(0, expiresAt.getTime() - Date.now())
  res.cookie('refreshToken', token, { ...AUTH_COOKIE_BASE, maxAge })
}

export function clearRefreshTokenCookie(res) {
  res.clearCookie('refreshToken', AUTH_COOKIE_BASE)
}

/** HMAC-SHA256 keyed hash — constant-time compare safe */
export function hashOtp(otp) {
  const secret = process.env.OTP_HASH_SECRET
  if (!secret) throw new Error('OTP_HASH_SECRET is required to issue or verify OTPs')
  return createHmac('sha256', secret).update(otp).digest('hex')
}

export function otpMatches(otp, storedHash) {
  const supplied  = Buffer.from(hashOtp(otp),   'hex')
  const expected  = Buffer.from(storedHash,       'hex')
  return supplied.length === expected.length && timingSafeEqual(supplied, expected)
}

/* ── Email / password helpers ───────────────────────────────────── */

export function normalizeEmail(value) {
  return typeof value === 'string' ? value.trim().toLowerCase() : ''
}

export function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]
  )
}

/* ── Request context ────────────────────────────────────────────── */

// Valid values for enum-typed columns on signup_risk_evaluations.
// Prisma throws at runtime if any other string is passed.
const NGINX_LIMIT_STATUSES    = new Set(['ALLOWED', 'RATE_LIMITED', 'CONNECTION_LIMITED', 'REJECTED'])
const GATEWAY_DECISION_STATUS = new Set(['ALLOWED', 'RATE_LIMITED', 'REJECTED'])
const GATEWAY_POLICY_STATUS   = new Set(['ALLOWED', 'DENIED', 'ERROR'])
const WAF_SECURITY_ACTIONS    = new Set(['ALLOW', 'BLOCK', 'CAPTCHA', 'CHALLENGE', 'COUNT'])
const WAF_CHALLENGE_TYPES     = new Set(['CAPTCHA', 'JS_CHALLENGE'])
const WAF_CHALLENGE_STATUSES  = new Set(['NOT_APPLICABLE', 'PENDING', 'PASSED', 'FAILED', 'EXPIRED'])

function safeEnum(value, allowed, fallback) {
  return allowed.has(value) ? value : fallback
}

/**
 * Device fingerprint — intentionally based only on stable device signals.
 * IP address is excluded: a device is still the same device when it changes
 * networks (mobile data ↔ Wi-Fi, VPN toggle). Mixing IP into the hash would
 * break device continuity and create phantom "new devices" on every IP change.
 */
export function requestFingerprint(req) {
  // Primary signal: User-Agent (browser + OS + engine).
  // Secondary signal: optional client-supplied device-id header (injected by
  // the app's SDK and forwarded by NGINX as x-device-id).
  const ua       = req.get('user-agent') || ''
  const deviceId = req.get('x-device-id') || ''
  return createHash('sha256')
    .update(`${ua}\0${deviceId}`)
    .digest('hex')
}

export function getTrustedRequestContext(req) {
  const header = (name) => req.get(name) || null

  const rawBotScore = header('x-waf-bot-score')
  const parsedBotScore = rawBotScore !== null ? Number(rawBotScore) : null
  const wafBotScore = Number.isInteger(parsedBotScore) && parsedBotScore >= 0 && parsedBotScore <= 100
    ? parsedBotScore
    : null
  const wafBotSignals = (header('x-waf-bot-signals') || '')
    .split(',')
    .map((signal) => signal.trim())
    .filter(Boolean)
  const connectionConcurrencyRaw = header('x-connection-concurrency')
  const parsedConnectionConcurrency = connectionConcurrencyRaw !== null
    ? Number(connectionConcurrencyRaw)
    : null

  // clientIp — real client IP resolved by Express trust-proxy from
  // the X-Forwarded-For header that NGINX injected.
  const clientIp = req.ip

  // peerIp — the IP of the connection that hit NGINX, i.e. the CloudFront
  // origin-facing IP. NGINX sets $realip_remote_addr and forwards it in
  // x-nginx-peer-ip. Falling back to the socket address would give 127.0.0.1
  // (loopback) because auth-service sits behind NGINX on localhost.
  const peerIp =
    header('x-nginx-peer-ip') ||
    req.socket?.remoteAddress ||
    clientIp

  if (!clientIp || !peerIp) throw new Error('REQUEST_IP_UNAVAILABLE')

  return {
    // ── Passthrough accessor (used by SignUp.controller for all ad-hoc headers) ──
    header,

    // ── Network ──────────────────────────────────────────────────────────────────
    clientIp,
    peerIp,

    // ── Device ───────────────────────────────────────────────────────────────────
    userAgent:   req.get('user-agent') || 'unknown',
    fingerprint: requestFingerprint(req),   // SHA-256(user-agent + device-id)

    // ── Coarse location (nullable) ───────────────────────────────────────────────
    // Read once here so both risk-eval create and trustedDevice upsert
    // use the same value without a second header read in the controller.
    coarseLocation: header('x-coarse-location') || null,

    // Risk signals consumed by the signup evaluator.
    wafBotScore,
    wafBotSignals,
    wafIpReputation: header('x-ip-reputation') || 'NO_MATCH',
    wafSecurityAction: safeEnum(
      header('x-waf-security-action'),
      WAF_SECURITY_ACTIONS,
      'ALLOW'
    ),
    wafChallengeType: safeEnum(
      header('x-waf-challenge-type'),
      WAF_CHALLENGE_TYPES,
      null
    ),
    wafChallengeStatus: safeEnum(
      header('x-waf-challenge-status'),
      WAF_CHALLENGE_STATUSES,
      'NOT_APPLICABLE'
    ),
    wafRateLimitTriggered: header('x-waf-rate-limit-triggered') === 'true',
    disposableEmailSignal: header('x-email-disposable'),
    phoneType: header('x-phone-type'),
    isRateOrSubnetSurge: header('x-rate-or-subnet-surge') === 'true',
    connectionConcurrency: Number.isInteger(parsedConnectionConcurrency) && parsedConnectionConcurrency >= 0
      ? parsedConnectionConcurrency
      : null,

    // ── Request metadata ──────────────────────────────────────────────────────────
    requestMethod:    req.method,                               // e.g. 'POST'
    requestUri:       req.originalUrl.split('?')[0].slice(0, 512),

    // ── Layer request IDs ─────────────────────────────────────────────────────────
    edgeRequestId:    header('x-amz-cf-id')          || randomUUID(),
    nginxRequestId:   header('x-nginx-request-id')   || randomUUID(),
    gatewayRequestId: header('x-gateway-request-id') || randomUUID(),

    // ── NGINX rate / connection limit outcomes (validated against schema enums) ───
    connectionLimitStatus: safeEnum(
      header('x-nginx-connection-limit-status'),
      NGINX_LIMIT_STATUSES,
      'ALLOWED'
    ),
    localRateLimitOutcome: safeEnum(
      header('x-nginx-rate-limit-status'),
      NGINX_LIMIT_STATUSES,
      'ALLOWED'
    ),

    // ── Gateway outcomes (validated against schema enums) ────────────────────────
    gatewayRateLimitStatus: safeEnum(
      header('x-gateway-rate-limit-status'),
      GATEWAY_DECISION_STATUS,
      'ALLOWED'
    ),
    gatewayPolicyStatus: safeEnum(
      header('x-gateway-policy-status'),
      GATEWAY_POLICY_STATUS,
      'ALLOWED'
    ),
  }
}

/* ── Audit logger ───────────────────────────────────────────────── */

export async function writeSignupAudit({ userId = null, email, eventType, context, metadata = {} }) {
  return prisma.authAuditLog.create({
    data: {
      userId,
      emailAttempted:       email,
      eventType,
      flowIntent:           'CREDENTIALS_SIGNUP',
      nginxRequestId:       context.nginxRequestId,
      clientIp:             context.clientIp,
      deviceFingerprintHash: context.fingerprint,
      userAgent:            context.userAgent,
      metadata,
    },
  })
}

/* ── Token / session constants ──────────────────────────────────── */

export const ACCESS_TOKEN_TTL   = '30m'
export const MAX_ACTIVE_SESSIONS = 2
export const DEVICE_TRUST_DAYS   = 30

export function getTrustedUntil(now = new Date()) {
  const days = Number(process.env.DEVICE_TRUST_DAYS) || DEVICE_TRUST_DAYS
  return new Date(now.getTime() + days * 24 * 60 * 60 * 1_000)
}

export function getRefreshTokenTtlDays() {
  const days = Number(process.env.REFRESH_TOKEN_TTL_DAYS)
  if (!Number.isInteger(days) || days <= 0)
    throw new Error('REFRESH_TOKEN_TTL_DAYS must be a positive integer')
  return days
}

export function hashRefreshToken(token) {
  return createHash('sha256').update(token).digest('hex')
}

export function isUuid(value) {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value)
  )
}

/* ════════════════════════════════════════════════════════════════════
   4H — UNIFIED SESSION ENGINE
   Creates a session, refresh token, and access JWT for a verified user.
   Called from both SignUp.controller (risk-OTP path) and
   verify.controller (email-OTP path).
   ════════════════════════════════════════════════════════════════════ */

export async function createSessionForUser({ userId, deviceFingerprintHash, clientIp, res }) {
  const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const issuer     = process.env.JWT_ISSUER
  const audience   = process.env.JWT_AUDIENCE

  if (!privateKey || !issuer || !audience)
    throw new Error('JWT_PRIVATE_KEY, JWT_ISSUER and JWT_AUDIENCE are required')

  const refreshTtlDays  = getRefreshTokenTtlDays()
  const now             = new Date()
  const refreshExpiresAt = new Date(now.getTime() + refreshTtlDays * 24 * 60 * 60 * 1_000)

  const refreshToken     = randomBytes(64).toString('base64url')
  const refreshTokenHash = hashRefreshToken(refreshToken)
  const familyId         = randomUUID()

  const result = await prisma.$transaction(
    async (tx) => {
      // Row-level lock — prevents concurrent session creation races.
      const locked = await tx.$queryRaw`
        SELECT id FROM users WHERE id = ${userId}::uuid FOR UPDATE
      `
      if (!locked.length) throw new Error('ACCOUNT_NOT_FOUND')

      const user = await tx.user.findUnique({
        where:  { id: userId },
        select: { id: true, role: true, isVerified: true, accountStatus: true },
      })

      if (!user || !user.isVerified || !['PENDING', 'ACTIVE'].includes(user.accountStatus))
        throw new Error('ACCOUNT_NOT_ELIGIBLE_FOR_SESSION')

      // The device MUST have been registered as trusted before we create a session.
      const trustedDevice = await tx.trustedDevice.findUnique({
        where: { userId_deviceFingerprintHash: { userId, deviceFingerprintHash } },
      })

      if (!trustedDevice || trustedDevice.isRevoked || (trustedDevice.trustedUntil && trustedDevice.trustedUntil <= now))
        throw new Error('DEVICE_NOT_TRUSTED')

      // Enforce concurrent-session limit.
      const activeSessions = await tx.userSession.findMany({
        where:   { userId, isActive: true, expiresAt: { gt: now } },
        orderBy: { createdAt: 'asc' },
        select:  { id: true },
      })

      const toRevoke =
        activeSessions.length >= MAX_ACTIVE_SESSIONS
          ? activeSessions.slice(0, activeSessions.length - MAX_ACTIVE_SESSIONS + 1)
          : []

      for (const old of toRevoke) {
        await tx.userSession.updateMany({
          where: { id: old.id, userId, isActive: true },
          data:  { isActive: false, revokedAt: now, revokeReason: 'CONCURRENCY_LIMIT_EXCEEDED' },
        })
        await tx.refreshToken.updateMany({
          where: { sessionId: old.id, isRevoked: false },
          data:  { isRevoked: true, revokedAt: now },
        })
      }

      const session = await tx.userSession.create({
        data: {
          userId,
          trustedDeviceId:      trustedDevice.id,
          familyId,
          clientIp,
          deviceFingerprintHash,
          isActive:    true,
          lastActiveAt: now,
          expiresAt:   refreshExpiresAt,
        },
      })

      await tx.refreshToken.create({
        data: {
          sessionId:  session.id,
          userId,
          familyId,
          tokenHash:  refreshTokenHash,
          isRevoked:  false,
          expiresAt:  refreshExpiresAt,
        },
      })

      const accessToken = jwt.sign(
        { session_id: session.id, role: user.role },
        privateKey,
        { algorithm: 'RS256', subject: user.id, expiresIn: ACCESS_TOKEN_TTL, issuer, audience }
      )

      // Flip PENDING → ACTIVE on first real session commit.
      const activated = await tx.user.updateMany({
        where: { id: userId, isVerified: true, accountStatus: { in: ['PENDING', 'ACTIVE'] } },
        data:  { accountStatus: 'ACTIVE', lastLoginAt: now },
      })

      if (activated.count !== 1) throw new Error('ACCOUNT_ACTIVATION_FAILED')

      return { sessionId: session.id, accessToken }
    },
    { timeout: 10_000 }
  )

  // Deliver the refresh token only after the transaction commits.
  setRefreshTokenCookie(res, refreshToken, refreshExpiresAt)

  return result
}

export async function writeAuthAudit({
  userId = null,
  email = null,
  eventType,
  flowIntent,
  context,
  metadata = {},
}) {
  return prisma.authAuditLog.create({
    data: {
      userId,
      emailAttempted:        email,
      eventType,
      flowIntent,
      nginxRequestId:        context.nginxRequestId,
      clientIp:              context.clientIp,
      deviceFingerprintHash: context.fingerprint,
      userAgent:             context.userAgent,
      metadata,
    },
  })
}
