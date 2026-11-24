import { randomBytes } from 'node:crypto'
import jwt from 'jsonwebtoken'
import prisma from '../lib/db.js'
import {
  hashRefreshToken,
  requestFingerprint,
  ACCESS_TOKEN_TTL,
  setRefreshTokenCookie,
  clearRefreshTokenCookie,
} from '../lib/auth.helpers.js'

function unauthorized(res) {
  clearRefreshTokenCookie(res)
  return res.status(401).json({ success: false, message: 'Session expired. Please sign in again.' })
}

async function revokeFamily(familyId, sessionId, now) {
  await prisma.$transaction(async (tx) => {
    await tx.refreshToken.updateMany({
      where: { familyId, isRevoked: false },
      data: { isRevoked: true, revokedAt: now },
    })
    await tx.userSession.updateMany({
      where: { id: sessionId, isActive: true },
      data: { isActive: false, revokedAt: now, revokeReason: 'REUSE_DETECTED' },
    })
  })
}

export async function refreshSession(req, res) {
 try {
  const rawRefreshToken = req.cookies?.refreshToken
  if (typeof rawRefreshToken !== 'string' || rawRefreshToken.length < 50 || rawRefreshToken.length > 100) return unauthorized(res)

  const token = await prisma.refreshToken.findUnique({
    where: { tokenHash: hashRefreshToken(rawRefreshToken) },
    include: {
      session: {
        include: {
          trustedDevice: true,
          user: { select: { id: true, role: true, isVerified: true, accountStatus: true } },
        },
      },
    },
  })
  if (!token) return unauthorized(res)

  const now = new Date()
  // A consumed token presented again means a rotation was replayed. The DB
  // record is the source of familyId; the browser never supplies that ID.
  if (token.usedAt) {
    await revokeFamily(token.familyId, token.sessionId, now)
    return unauthorized(res)
  }
  if (token.isRevoked) return unauthorized(res)

  const { session } = token
  const { user, trustedDevice } = session
  const fingerprint = requestFingerprint(req)
  if (
    token.expiresAt <= now || session.expiresAt <= now || !session.isActive ||
    !user?.isVerified || user.accountStatus !== 'ACTIVE' ||
    session.deviceFingerprintHash !== fingerprint ||
    !trustedDevice || trustedDevice.isRevoked || trustedDevice.trustedUntil <= now
  ) {
    return unauthorized(res)
  }

  const privateKey = process.env.JWT_PRIVATE_KEY?.replace(/\\n/g, '\n')
  const issuer = process.env.JWT_ISSUER
  const audience = process.env.JWT_AUDIENCE
  if (!privateKey || !issuer || !audience) {
    return res.status(500).json({ success: false, message: 'Authentication service is not configured.' })
  }

  const nextRefreshToken = randomBytes(64).toString('base64url')
  const nextRefreshHash = hashRefreshToken(nextRefreshToken)
  const nextAccessToken = jwt.sign(
    { session_id: session.id, role: user.role },
    privateKey,
    { algorithm: 'RS256', subject: user.id, expiresIn: ACCESS_TOKEN_TTL, issuer, audience }
  )

  const rotated = await prisma.$transaction(async (tx) => {
    const consumed = await tx.refreshToken.updateMany({
      where: { id: token.id, isRevoked: false, usedAt: null, expiresAt: { gt: now } },
      data: { isRevoked: true, usedAt: now, revokedAt: now },
    })
    if (consumed.count !== 1) return false

    await tx.refreshToken.create({
      data: {
        sessionId: token.sessionId,
        userId: token.userId,
        familyId: token.familyId,
        tokenHash: nextRefreshHash,
        parentTokenId: token.id,
        expiresAt: token.expiresAt,
      },
    })
    await tx.userSession.update({ where: { id: session.id }, data: { lastActiveAt: now } })
    return true
  })

  if (!rotated) {
    const latest = await prisma.refreshToken.findUnique({ where: { id: token.id }, select: { usedAt: true } })
    if (latest?.usedAt) await revokeFamily(token.familyId, token.sessionId, new Date())
    return unauthorized(res)
  }

  setRefreshTokenCookie(res, nextRefreshToken, token.expiresAt)
  return res.status(200).json({ success: true, accessToken: nextAccessToken, nextStep: 'AUTHENTICATED' })
 } catch (error) {
  console.error('[auth-service] token refresh failed:', error)
  return res.status(500).json({ success: false, message: 'Unable to refresh session. Please try again.' })
 }
}
