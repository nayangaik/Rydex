import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import prisma from '../../shared/database/index.js'

const app = express()
const PORT = process.env.PORT || 5007

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

// ─── Middleware ─────────────────────────────────────────────────────────────

function internal(req, res, next) {
  if (!process.env.INTERNAL_SERVICE_TOKEN || req.get('x-internal-service-token') !== process.env.INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized service request' })
  }
  const userId = req.get('x-user-id')
  const role = req.get('x-user-role')
  if (!userId || !role) return res.status(401).json({ error: 'User identity required' })
  req.actor = { userId, role }
  next()
}

const adminOnly = (req, res, next) =>
  req.actor?.role === 'admin' ? next() : res.status(403).json({ error: 'Admin access required' })

app.use(cors())
app.use('/api', express.json({ limit: '1mb' }))
app.use('/api', internal)

// ─── Health ─────────────────────────────────────────────────────────────────

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'admin-service' })
})

// ─── DASHBOARD & ANALYTICS ───────────────────────────────────────────────────

app.get('/api/admin/dashboard', adminOnly, async (req, res, next) => {
  try {
    const [
      totalVendors,
      approved,
      pending,
      rejected,
      totalUsers,
      totalBookings,
      revenueAgg,
      pendingVendors,
      pendingVehiclesRaw,
      recentBookings,
    ] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] } } }),
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'approved' } }),
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'pending' } }),
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'rejected' } }),
      prisma.user.count({ where: { role: 'user' } }),
      prisma.booking.count(),
      prisma.booking.aggregate({ _sum: { fare: true }, where: { status: 'completed' } }),
      prisma.user.findMany({
        where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'pending' },
        select: { id: true, name: true, email: true, vendorStatus: true },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.vehicle.findMany({
        where: { status: 'pending' },
        include: { owner: { select: { name: true, email: true } } },
        take: 10,
        orderBy: { createdAt: 'desc' },
      }),
      prisma.booking.findMany({
        where: { status: 'completed' },
        include: {
          user: { select: { name: true } },
          vendor: { select: { name: true } },
        },
        orderBy: { completedAt: 'desc' },
        take: 5,
      }),
    ])

    const pendingVehicles = pendingVehiclesRaw.map((v) => ({
      _id: v.id,
      ownerName: v.owner.name,
      ownerEmail: v.owner.email,
      type: v.type,
      vehicleModel: v.vehicleModel,
      number: v.number,
      status: v.status,
    }))

    res.json({
      stats: {
        totalVendors,
        approved,
        pending,
        rejected,
        totalUsers,
        totalBookings,
        totalRevenue: revenueAgg._sum.fare ?? 0,
      },
      pendingVendors: pendingVendors.map((v) => ({ _id: v.id, name: v.name, email: v.email, vendorStatus: v.vendorStatus })),
      pendingVehicles,
      recentBookings: recentBookings.map((b) => ({
        id: b.id,
        userName: b.user.name,
        vendorName: b.vendor.name,
        fare: b.fare,
        completedAt: b.completedAt,
      })),
    })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/earnings', adminOnly, async (req, res, next) => {
  try {
    let days = parseInt(req.query.days) || 7
    if (days > 90) days = 90

    const since = new Date()
    since.setDate(since.getDate() - days + 1)
    since.setHours(0, 0, 0, 0)

    const bookings = await prisma.booking.findMany({
      where: { status: 'completed', completedAt: { gte: since } },
      select: { fare: true, completedAt: true },
    })

    // Build a map of date string -> { earnings, trips }
    const map = {}
    for (let i = 0; i < days; i++) {
      const d = new Date(since)
      d.setDate(since.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      map[key] = { date: key, day: DAY_LABELS[d.getDay()], earnings: 0, trips: 0 }
    }

    for (const b of bookings) {
      if (!b.completedAt) continue
      const key = b.completedAt.toISOString().slice(0, 10)
      if (map[key]) {
        map[key].earnings += b.fare
        map[key].trips += 1
      }
    }

    let earnings = Object.values(map)

    const allZero = earnings.every((e) => e.earnings === 0)
    let demo = false

    if (allZero) {
      // Return demo data
      demo = true
      earnings = earnings.map((e, i) => ({
        ...e,
        earnings: Math.round(500 + Math.random() * 2000),
        trips: Math.floor(5 + Math.random() * 20),
      }))
    }

    const totals = earnings.reduce((acc, e) => ({ total: acc.total + e.earnings, trips: acc.trips + e.trips }), { total: 0, trips: 0 })
    const earningsValues = earnings.map((e) => e.earnings)

    res.json({
      earnings,
      summary: {
        total: totals.total,
        avg: earnings.length ? totals.total / earnings.length : 0,
        max: Math.max(...earningsValues),
        totalTrips: totals.trips,
      },
      demo,
    })
  } catch (err) {
    next(err)
  }
})

// ─── USER MANAGEMENT ─────────────────────────────────────────────────────────

app.get('/api/admin/users', adminOnly, async (req, res, next) => {
  try {
    const { role, status, search } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where = {}
    if (role) where.role = role
    if (status === 'blocked') where.isVendorBlocked = true
    if (status === 'active') where.isVendorBlocked = false
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { email: { contains: search, mode: 'insensitive' } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownedVehicle: { select: { type: true, status: true } },
          _count: { select: { bookingsAsUser: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    res.json({
      users: users.map(({ password, otp, otpExpiry, ...u }) => u),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/users/:userId', adminOnly, async (req, res, next) => {
  try {
    const user = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.userId },
      include: {
        ownedVehicle: true,
        partnerDocs: { select: { status: true, rejectionReason: true } },
        partnerBank: { select: { status: true } },
        _count: { select: { bookingsAsUser: true, bookingsAsVendor: true } },
      },
    })
    const { password, otp, otpExpiry, ...safe } = user
    res.json({ user: safe })
  } catch (err) {
    next(err)
  }
})

app.patch('/api/admin/users/:userId', adminOnly, async (req, res, next) => {
  try {
    const { role, isVendorBlocked, vendorStatus } = req.body
    const data = {}

    if (role !== undefined) {
      if (!['user', 'vendor', 'admin', 'partner'].includes(role)) {
        return res.status(400).json({ error: 'Invalid role' })
      }
      data.role = role
    }
    if (isVendorBlocked !== undefined) {
      if (typeof isVendorBlocked !== 'boolean') return res.status(400).json({ error: 'isVendorBlocked must be boolean' })
      data.isVendorBlocked = isVendorBlocked
    }
    if (vendorStatus !== undefined) {
      if (!['approved', 'rejected', 'pending'].includes(vendorStatus)) {
        return res.status(400).json({ error: 'Invalid vendorStatus' })
      }
      data.vendorStatus = vendorStatus
    }

    const updated = await prisma.user.update({
      where: { id: req.params.userId },
      data,
    })
    const { password, otp, otpExpiry, ...safe } = updated
    res.json({ user: safe })
  } catch (err) {
    next(err)
  }
})

app.delete('/api/admin/users/:userId', adminOnly, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.userId },
      data: { isVendorBlocked: true, isOnline: false, socketId: null },
    })
    res.json({ message: 'User deactivated' })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/users/:userId/audit', adminOnly, async (req, res, next) => {
  try {
    const uid = req.params.userId

    const [asUser, asVendor] = await Promise.all([
      prisma.booking.findMany({
        where: { userId: uid },
        include: { vendor: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
      prisma.booking.findMany({
        where: { vendorId: uid },
        include: { user: { select: { name: true } } },
        orderBy: { createdAt: 'desc' },
        take: 50,
      }),
    ])

    const combined = [
      ...asUser.map((b) => ({
        id: b.id,
        role: 'user',
        fare: b.fare,
        status: b.status,
        createdAt: b.createdAt,
        pickupAt: b.pickupAt,
        completedAt: b.completedAt,
        counterpartName: b.vendor.name,
      })),
      ...asVendor.map((b) => ({
        id: b.id,
        role: 'vendor',
        fare: b.fare,
        status: b.status,
        createdAt: b.createdAt,
        pickupAt: b.pickupAt,
        completedAt: b.completedAt,
        counterpartName: b.user.name,
      })),
    ]
      .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
      .slice(0, 50)

    res.json({ audit: combined })
  } catch (err) {
    next(err)
  }
})

// ─── VENDOR MANAGEMENT ───────────────────────────────────────────────────────

app.get('/api/admin/vendors', adminOnly, async (req, res, next) => {
  try {
    const { status } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where = { role: { in: ['vendor', 'partner'] } }
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.vendorStatus = status
    }

    const [vendors, total] = await Promise.all([
      prisma.user.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          ownedVehicle: { select: { type: true, number: true, status: true } },
          partnerDocs: { select: { status: true } },
        },
      }),
      prisma.user.count({ where }),
    ])

    res.json({
      vendors: vendors.map(({ password, otp, otpExpiry, ...v }) => v),
      total,
      page,
      totalPages: Math.ceil(total / limit),
    })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/vendors/:id', adminOnly, async (req, res, next) => {
  try {
    const vendor = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        ownedVehicle: true,
        partnerDocs: true,
        partnerBank: true,
      },
    })
    const { password, otp, otpExpiry, ...safe } = vendor
    res.json({
      vendor: {
        _id: safe.id,
        ...safe,
        vehicle: safe.ownedVehicle,
        documents: safe.partnerDocs,
        bank: safe.partnerBank,
        videoKycStatus: safe.videoKycStatus,
      },
    })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vendors/:id/approve', adminOnly, async (req, res, next) => {
  try {
    const vendor = await prisma.user.findUniqueOrThrow({ where: { id: req.params.id } })

    const kycData = {}
    if (!['approved', 'not_required'].includes(vendor.videoKycStatus)) {
      kycData.videoKycStatus = 'pending'
    }

    await prisma.user.update({
      where: { id: req.params.id },
      data: {
        vendorStatus: 'approved',
        role: 'partner',
        vendorApprovedAt: new Date(),
        vendorRejectionReason: '',
        ...kycData,
      },
    })
    res.json({ message: 'Vendor approved' })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vendors/:id/reject', adminOnly, async (req, res, next) => {
  try {
    const { reason } = req.body
    if (!reason) return res.status(400).json({ error: 'Rejection reason required' })

    const vendor = await prisma.user.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { ownedVehicle: true, partnerDocs: true },
    })

    await prisma.user.update({
      where: { id: req.params.id },
      data: { vendorStatus: 'rejected', vendorRejectionReason: reason },
    })

    if (vendor.ownedVehicle) {
      await prisma.vehicle.update({
        where: { id: vendor.ownedVehicle.id },
        data: { status: 'rejected' },
      })
    }
    if (vendor.partnerDocs) {
      await prisma.partnerDocs.update({
        where: { id: vendor.partnerDocs.id },
        data: { status: 'rejected' },
      })
    }

    res.json({ message: 'Vendor rejected' })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vendors/:id/block', adminOnly, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isVendorBlocked: true, isOnline: false },
    })
    res.json({ message: 'Vendor blocked' })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vendors/:id/unblock', adminOnly, async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.params.id },
      data: { isVendorBlocked: false },
    })
    res.json({ message: 'Vendor unblocked' })
  } catch (err) {
    next(err)
  }
})

// ─── VIDEO KYC ───────────────────────────────────────────────────────────────

// NOTE: static routes MUST come before /:id to avoid conflicts
app.get('/api/admin/vendors/video-kyc/pending', adminOnly, async (req, res, next) => {
  try {
    const vendors = await prisma.user.findMany({
      where: {
        role: { in: ['vendor', 'partner'] },
        videoKycStatus: { in: ['pending', 'in_progress'] },
      },
      select: { id: true, name: true, email: true, videoKycStatus: true, videoKycRoomId: true },
    })
    res.json(vendors.map((v) => ({ _id: v.id, name: v.name, email: v.email, videoKycStatus: v.videoKycStatus, videoKycRoomId: v.videoKycRoomId })))
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vendors/video-kyc/start/:vendorId', adminOnly, async (req, res, next) => {
  try {
    const { vendorId } = req.params
    const roomId = `kyc-${vendorId}-${Date.now()}`
    await prisma.user.update({
      where: { id: vendorId },
      data: { videoKycStatus: 'in_progress', videoKycRoomId: roomId },
    })
    res.json({ roomId })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vendors/video-kyc/complete', adminOnly, async (req, res, next) => {
  try {
    const { vendorId, decision, reason } = req.body
    if (!vendorId) return res.status(400).json({ error: 'vendorId required' })
    if (!['approved', 'rejected'].includes(decision)) {
      return res.status(400).json({ error: "decision must be 'approved' or 'rejected'" })
    }
    if (decision === 'rejected' && !reason) {
      return res.status(400).json({ error: 'Rejection reason required' })
    }

    let data
    if (decision === 'approved') {
      const vendor = await prisma.user.findUniqueOrThrow({ where: { id: vendorId } })
      data = {
        videoKycStatus: 'approved',
        videoKycRoomId: null,
        vendorOnboardingStep: Math.max(vendor.vendorOnboardingStep, 5),
      }
    } else {
      data = {
        videoKycStatus: 'rejected',
        videoKycRejectionReason: reason,
        videoKycRoomId: null,
      }
    }

    await prisma.user.update({ where: { id: vendorId }, data })
    res.json({ message: `Video KYC ${decision}` })
  } catch (err) {
    next(err)
  }
})

// ─── VEHICLE MANAGEMENT ──────────────────────────────────────────────────────

app.get('/api/admin/vehicles', adminOnly, async (req, res, next) => {
  try {
    const { status } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where = {}
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status
    }

    const [vehicles, total] = await Promise.all([
      prisma.vehicle.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { owner: { select: { id: true, name: true, email: true, vendorStatus: true } } },
      }),
      prisma.vehicle.count({ where }),
    ])

    res.json({ vehicles, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/vehicles/:id', adminOnly, async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUniqueOrThrow({
      where: { id: req.params.id },
      include: { owner: { select: { id: true, name: true, email: true } } },
    })
    res.json({
      vehicle: {
        ...vehicle,
        ownerName: vehicle.owner.name,
        ownerEmail: vehicle.owner.email,
      },
    })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vehicles/:id/approve', adminOnly, async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUniqueOrThrow({ where: { id: req.params.id } })

    await prisma.$transaction([
      prisma.vehicle.update({
        where: { id: req.params.id },
        data: { status: 'approved', rejectionReason: '' },
      }),
      prisma.user.update({
        where: { id: vehicle.ownerId },
        data: { vehicleId: req.params.id, vendorOnboardingStep: 7 },
      }),
    ])
    res.json({ message: 'Vehicle approved' })
  } catch (err) {
    next(err)
  }
})

app.post('/api/admin/vehicles/:id/reject', adminOnly, async (req, res, next) => {
  try {
    const { reason } = req.body
    if (!reason) return res.status(400).json({ error: 'Rejection reason required' })

    await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { status: 'rejected', rejectionReason: reason },
    })
    res.json({ message: 'Vehicle rejected' })
  } catch (err) {
    next(err)
  }
})

// ─── BOOKING OVERVIEW ────────────────────────────────────────────────────────

app.get('/api/admin/bookings', adminOnly, async (req, res, next) => {
  try {
    const { status, vendorId, userId } = req.query
    const page = Math.max(1, parseInt(req.query.page) || 1)
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20))
    const skip = (page - 1) * limit

    const where = {}
    if (status) where.status = status
    if (vendorId) where.vendorId = vendorId
    if (userId) where.userId = userId

    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          user: { select: { name: true, email: true } },
          vendor: { select: { name: true, email: true } },
          vehicle: { select: { type: true, number: true } },
        },
      }),
      prisma.booking.count({ where }),
    ])

    res.json({ bookings, total, page, totalPages: Math.ceil(total / limit) })
  } catch (err) {
    next(err)
  }
})

app.get('/api/admin/bookings/:id', adminOnly, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findUniqueOrThrow({
      where: { id: req.params.id },
      include: {
        user: true,
        vendor: true,
        vehicle: true,
      },
    })
    res.json({ booking })
  } catch (err) {
    next(err)
  }
})

// ─── Error Handler ───────────────────────────────────────────────────────────

app.use((error, _req, res, _next) => {
  console.error('[admin-service]', error)
  if (error.code === 'P2025') return res.status(404).json({ error: 'Record not found' })
  if (error.code === 'P2002') return res.status(409).json({ error: 'Duplicate record' })
  res.status(500).json({ error: 'Admin service request failed' })
})

app.listen(PORT, () => console.log(`admin-service running at http://localhost:${PORT}`))
