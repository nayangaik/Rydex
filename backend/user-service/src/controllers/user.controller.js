import prisma from '../lib/db.js'
import { uploadBuffer } from '../lib/upload.js'
import { ensureAccount, audit } from './helpers.js'

const PROFILE_FIELDS = [
  'name', 'phone', 'addressLine1', 'addressLine2', 'city', 'state',
  'postalCode', 'country', 'contactDetails',
]

export async function getMyProfile(req, res, next) {
  try {
    const userId = req.actor.userId
    const [profile, account] = await Promise.all([
      prisma.userProfile.findUnique({ where: { userId } }),
      ensureAccount(userId),
    ])
    const requests = await prisma.accountRequest.findMany({ where: { userId }, orderBy: { requestedAt: 'desc' } })
    res.json({ profile: profile ?? { userId }, account: { ...account, requests } })
  } catch (error) { next(error) }
}

export async function updateMyProfile(req, res, next) {
  try {
    const data = {}
    for (const field of PROFILE_FIELDS) {
      const value = req.body?.[field]
      if (value !== undefined) {
        if (typeof value !== 'string' || value.length > 500) return res.status(400).json({ error: `Invalid ${field}` })
        data[field] = value.trim() || null
      }
    }
    const profile = await prisma.userProfile.upsert({
      where: { userId: req.actor.userId },
      create: { userId: req.actor.userId, ...data },
      update: data,
    })
    await audit(req.actor.userId, req.actor.userId, 'profile.updated', 'User profile updated')
    res.json({ profile })
  } catch (error) { next(error) }
}

export async function updateMyProfilePhoto(req, res, next) {
  try {
    if (!req.file) return res.status(400).json({ error: 'A profile photo is required' })
    const photoUrl = await uploadBuffer(req.file.buffer, `rydex/profile-photos/${req.actor.userId}`)
    await prisma.userProfile.upsert({
      where: { userId: req.actor.userId },
      create: { userId: req.actor.userId, photoUrl },
      update: { photoUrl },
    })
    await audit(req.actor.userId, req.actor.userId, 'profile.photo.updated', 'Profile photo updated')
    res.json({ photoUrl })
  } catch (error) { next(error) }
}

export async function createAccountRequest(req, res, next) {
  try {
    const { type } = req.body ?? {}
    if (!['deactivation', 'reactivation', 'deletion'].includes(type)) {
      return res.status(400).json({ error: 'Unsupported account request type' })
    }

    const userId = req.actor.userId
    await ensureAccount(userId)
    const result = await prisma.$transaction(async (tx) => {
      const account = await tx.userAccount.findUnique({ where: { userId } })
      const pending = await tx.accountRequest.findFirst({ where: { userId, status: 'pending' } })
      if (pending) return { conflict: 'An account request is already pending' }

      const allowed = type === 'deactivation'
        ? account.status === 'active'
        : type === 'reactivation'
          ? ['suspended', 'deactivation_requested'].includes(account.status)
          : ['active', 'suspended', 'deactivation_requested'].includes(account.status)
      if (!allowed) return { conflict: `Cannot request ${type} while account is ${account.status}` }

      const requestedStatus = type === 'deactivation'
        ? 'deactivation_requested'
        : type === 'deletion'
          ? 'deletion_requested'
          : account.status
      const request = await tx.accountRequest.create({
        data: { userId, type, previousStatus: account.status },
      })
      if (requestedStatus !== account.status) {
        await tx.userAccount.update({ where: { userId }, data: { status: requestedStatus } })
      }
      return { request }
    })
    if (result.conflict) return res.status(409).json({ error: result.conflict })
    await audit(userId, userId, `account.${type}.requested`, `Request ${result.request.id} submitted`)
    res.status(201).json({ message: 'Account request submitted', request: result.request })
  } catch (error) { next(error) }
}

export async function listUserAccounts(req, res, next) {
  try {
    const accounts = await prisma.userAccount.findMany({ orderBy: { updatedAt: 'desc' } })
    const userIds = accounts.map(({ userId }) => userId)
    const [profiles, requests] = await Promise.all([
      prisma.userProfile.findMany({ where: { userId: { in: userIds } } }),
      prisma.accountRequest.findMany({ where: { userId: { in: userIds } }, orderBy: { requestedAt: 'desc' } }),
    ])
    const profileById = new Map(profiles.map((profile) => [profile.userId, profile]))
    const requestsById = new Map()
    for (const request of requests) requestsById.set(request.userId, [...(requestsById.get(request.userId) ?? []), request])
    res.json(accounts.map((account) => ({ ...account, profile: profileById.get(account.userId) ?? null, requests: requestsById.get(account.userId) ?? [] })))
  } catch (error) { next(error) }
}

export async function getUserAccount(req, res, next) {
  try {
    const userId = req.params.userId
    const [account, profile, requests] = await Promise.all([
      prisma.userAccount.findUnique({ where: { userId } }),
      prisma.userProfile.findUnique({ where: { userId } }),
      prisma.accountRequest.findMany({ where: { userId }, orderBy: { requestedAt: 'desc' } }),
    ])
    if (!account) return res.status(404).json({ error: 'Account not found' })
    res.json({ ...account, profile, requests })
  } catch (error) { next(error) }
}

export async function updateUserAccountStatus(req, res, next) {
  try {
    const { status } = req.body ?? {}
    if (!['active', 'suspended'].includes(status)) return res.status(400).json({ error: 'Status must be active or suspended' })
    const userId = req.params.userId
    const account = await prisma.userAccount.update({ where: { userId }, data: { status } })
    await audit(userId, req.actor.userId, 'account.status.updated', `Account status changed to ${status}`)
    res.json({ account })
  } catch (error) { next(error) }
}

export async function resolveAccountRequest(req, res, next) {
  try {
    const { decision } = req.body ?? {}
    if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'Decision must be approved or rejected' })
    const request = await prisma.accountRequest.findUnique({ where: { id: req.params.requestId } })
    if (!request) return res.status(404).json({ error: 'Account request not found' })
    if (request.status !== 'pending') return res.status(409).json({ error: 'Account request has already been resolved' })

    const statusOnApproval = { deactivation: 'suspended', reactivation: 'active', deletion: 'deleted' }
    const nextStatus = decision === 'approved' ? statusOnApproval[request.type] : request.previousStatus || 'active'
    const [updatedRequest, account] = await prisma.$transaction([
      prisma.accountRequest.update({ where: { id: request.id }, data: { status: decision, resolvedAt: new Date() } }),
      prisma.userAccount.update({ where: { userId: request.userId }, data: { status: nextStatus } }),
    ])
    await audit(request.userId, req.actor.userId, `account.${request.type}.${decision}`, `Request ${request.id} ${decision}`)
    res.json({ request: updatedRequest, account })
  } catch (error) { next(error) }
}

export async function getUserAuditEvents(req, res, next) {
  try {
    const events = await prisma.accountAuditEvent.findMany({
      where: { userId: req.params.userId },
      orderBy: { createdAt: 'desc' },
      take: 100,
    })
    res.json({ events })
  } catch (error) { next(error) }
}
