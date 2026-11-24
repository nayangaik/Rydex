import prisma from '../lib/db.js'

// ---------------------------------------------------------------------------
// GET /api/admin/vendors/:id
// ---------------------------------------------------------------------------
export async function getVendor(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        name: true,
        email: true,
        vendorStatus: true,
        vendorRejectionReason: true,
        vendorOnboardingStep: true,
        videoKycStatus: true,
        videoKycRoomId: true,
        videoKycRejectionReason: true,
        ownedVehicle: true,
        partnerDocs: true,
        partnerBank: true,
      },
    })
    if (!user) return res.status(404).json({ message: 'Vendor not found' })
    res.json({
      vendor: {
        _id: user.id,
        ...user,
        vehicle: user.ownedVehicle,
        documents: user.partnerDocs,
        bank: user.partnerBank,
      },
    })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/vendors/:id/approve
// ---------------------------------------------------------------------------
export async function approveVendor(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { vendorOnboardingStep: true },
    })
    if (!user) return res.status(404).json({ message: 'Vendor not found' })
    const videoKycStatus = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { videoKycStatus: true },
    })
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.params.id },
        data: {
          vendorStatus: 'approved',
          role: 'partner',
          vendorApprovedAt: new Date(),
          vendorRejectionReason: '',
          vendorOnboardingStep: Math.max(user.vendorOnboardingStep, 4),
        },
      }),
      prisma.partnerDocs.updateMany({
        where: { ownerId: req.params.id },
        data: { status: 'approved', rejectionReason: '' },
      }),
      prisma.partnerBank.updateMany({
        where: { ownerId: req.params.id },
        data: { status: 'verified' },
      }),
    ])
    res.json({ message: 'Vendor approved successfully', videoKycStatus: videoKycStatus?.videoKycStatus })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/vendors/:id/reject
// ---------------------------------------------------------------------------
export async function rejectVendor(req, res, next) {
  try {
    const reason = req.body.reason?.trim()
    if (!reason) return res.status(400).json({ message: 'Rejection reason is required' })
    const exists = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true } })
    if (!exists) return res.status(404).json({ message: 'Vendor not found' })
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.params.id },
        data: { vendorStatus: 'rejected', vendorRejectionReason: reason },
      }),
      prisma.partnerDocs.updateMany({
        where: { ownerId: req.params.id },
        data: { status: 'rejected', rejectionReason: reason },
      }),
    ])
    res.json({ message: 'Vendor rejected successfully' })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/vendors/video-kyc/pending
// ---------------------------------------------------------------------------
export async function getVideoKycPending(_req, res, next) {
  try {
    const users = await prisma.user.findMany({
      where: { role: { in: ['vendor', 'partner'] }, videoKycStatus: { in: ['pending', 'in_progress'] } },
      select: { id: true, name: true, email: true, videoKycStatus: true, videoKycRoomId: true },
    })
    res.json(
      users.map((user) => ({
        _id: user.id,
        name: user.name,
        email: user.email,
        videoKycStatus: user.videoKycStatus,
        videoKycRoomId: user.videoKycRoomId,
      }))
    )
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/vendors/video-kyc/start/:vendorId
// ---------------------------------------------------------------------------
export async function startVideoKyc(req, res, next) {
  try {
    if (!req.params.vendorId) return res.status(400).json({ message: 'vendorId is required' })
    const roomId = `kyc-${req.params.vendorId}-${Date.now()}`
    await prisma.user.update({
      where: { id: req.params.vendorId },
      data: { videoKycStatus: 'in_progress', videoKycRoomId: roomId },
    })
    res.json({ roomId })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/vendors/video-kyc/complete
// ---------------------------------------------------------------------------
export async function completeVideoKyc(req, res, next) {
  try {
    const { roomId, vendorId, action, decision, reason } = req.body
    const outcome = action || decision
    if (
      !['approve', 'reject', 'approved', 'rejected'].includes(outcome) ||
      (!roomId && !vendorId)
    ) {
      return res.status(400).json({ message: 'roomId (or vendorId) and a valid action are required' })
    }
    if ((outcome === 'reject' || outcome === 'rejected') && !reason?.trim()) {
      return res.status(400).json({ message: 'A rejection reason is required' })
    }
    const vendor = roomId
      ? await prisma.user.findFirst({
          where: { videoKycRoomId: roomId },
          select: { id: true, vendorOnboardingStep: true },
        })
      : await prisma.user.findUnique({
          where: { id: vendorId },
          select: { id: true, vendorOnboardingStep: true },
        })
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })
    const approved = outcome === 'approve' || outcome === 'approved'
    await prisma.user.update({
      where: { id: vendor.id },
      data: approved
        ? {
            videoKycStatus: 'approved',
            videoKycRoomId: null,
            videoKycRejectionReason: null,
            vendorOnboardingStep: Math.max(vendor.vendorOnboardingStep, 5),
          }
        : {
            videoKycStatus: 'rejected',
            videoKycRoomId: null,
            videoKycRejectionReason: reason.trim(),
          },
    })
    res.json({ message: `Video KYC ${approved ? 'approved' : 'rejected'} successfully` })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/admin/vehicles/:id
// ---------------------------------------------------------------------------
export async function getVehicle(req, res, next) {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      include: { owner: { select: { id: true, name: true, email: true } } },
    })
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })
    res.json({
      vehicle: { ...vehicle, ownerName: vehicle.owner.name, ownerEmail: vehicle.owner.email },
    })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/vehicles/:id/approve
// ---------------------------------------------------------------------------
export async function approveVehicle(req, res, next) {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { id: req.params.id },
      select: { ownerId: true },
    })
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })
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
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/vehicles/:id/reject
// ---------------------------------------------------------------------------
export async function rejectVehicle(req, res, next) {
  try {
    const reason = req.body.reason?.trim()
    if (!reason) return res.status(400).json({ message: 'Rejection reason is required' })
    const vehicle = await prisma.vehicle.update({
      where: { id: req.params.id },
      data: { status: 'rejected', rejectionReason: reason },
    })
    res.json({ vehicle })
  } catch (error) {
    next(error)
  }
}
