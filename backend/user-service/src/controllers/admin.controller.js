import prisma from '../lib/db.js'
import { DAY_LABELS } from './helpers.js'

export const getAdminDashboard = async (req, res, next) => {
  try {
    const [totalVendors, approved, pending, rejected] = await Promise.all([
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] } } }),
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'approved' } }),
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'pending' } }),
      prisma.user.count({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'rejected' } }),
    ])
    const [pendingVendorsData, approvedVendors] = await Promise.all([
      prisma.user.findMany({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'pending' }, select: { id: true, name: true, email: true, vendorStatus: true } }),
      prisma.user.findMany({ where: { role: { in: ['vendor', 'partner'] }, vendorStatus: 'approved' }, select: { id: true } }),
    ])
    const pendingVehiclesData = await prisma.vehicle.findMany({
      where: { status: 'pending', ownerId: { in: approvedVendors.map((v) => v.id) } },
      include: { owner: { select: { name: true, email: true } } },
    })
    res.json({
      stats: { totalVendors, approved, pending, rejected },
      pendingVendors: pendingVendorsData.map((v) => ({ _id: v.id, name: v.name, email: v.email, vendorStatus: v.vendorStatus })),
      pendingVehicles: pendingVehiclesData.map((v) => ({ _id: v.id, ownerName: v.owner?.name, ownerEmail: v.owner?.email, type: v.type, vehicleModel: v.vehicleModel, number: v.number, status: v.status })),
    })
  } catch (error) { next(error) }
}

export const getAdminEarnings = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days || '7'), 90)
    const since = new Date(); since.setDate(since.getDate() - days + 1); since.setHours(0, 0, 0, 0)
    const rows = await prisma.$queryRaw`
      SELECT TO_CHAR("completedAt", 'YYYY-MM-DD') as "_id", COALESCE(SUM(fare), 0) as earnings
      FROM "Booking" WHERE "status" = 'completed'::"BookingStatus" AND "completedAt" >= ${since}
      GROUP BY TO_CHAR("completedAt", 'YYYY-MM-DD') ORDER BY "_id" ASC`
    const earningsMap = new Map(rows.map((r) => [r._id, r.earnings]))
    const earnings = Array.from({ length: days }, (_, i) => {
      const d = new Date(since); d.setDate(since.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const label = days <= 7 ? DAY_LABELS[d.getDay()] : key.slice(5)
      return { date: label, earnings: earningsMap.get(key) ?? 0 }
    })
    if (earnings.every((e) => e.earnings === 0)) {
      const demo = Array.from({ length: days }, (_, i) => {
        const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
        const label = days <= 7 ? DAY_LABELS[d.getDay()] : d.toISOString().slice(5, 10)
        return { date: label, earnings: Math.round(8500 + Math.sin(i * 2.4 + 1) * 3200) }
      })
      return res.json({ earnings: demo, demo: true })
    }
    const total = earnings.reduce((s, e) => s + e.earnings, 0)
    res.json({ earnings, summary: { total, avg: Math.round(total / days), max: Math.max(...earnings.map((e) => e.earnings)) } })
  } catch (error) { next(error) }
}

export const getAdminVendor = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: { id: true, name: true, email: true, vendorStatus: true, ownedVehicle: true, partnerDocs: true, partnerBank: true },
    })
    if (!user) return res.status(404).json({ message: 'Vendor not found' })
    res.json({
      vendor: {
        _id: user.id, name: user.name, email: user.email, vendorStatus: user.vendorStatus,
        vehicle: user.ownedVehicle ? { type: user.ownedVehicle.type, number: user.ownedVehicle.number, model: user.ownedVehicle.vehicleModel } : null,
        documents: user.partnerDocs ? { aadhaarUrl: user.partnerDocs.aadharUrl, licenseUrl: user.partnerDocs.licenseUrl, rcUrl: user.partnerDocs.rcUrl } : null,
        bank: user.partnerBank ? { accountHolderName: user.partnerBank.accountHolder, ifsc: user.partnerBank.ifsc, upi: user.partnerBank.upi } : null,
      },
    })
  } catch (error) { next(error) }
}

export const approveAdminVendor = async (req, res, next) => {
  try {
    const vendor = await prisma.user.findUnique({ where: { id: req.params.id }, select: { id: true, videoKycStatus: true } })
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })
    const videoKycStatus = vendor.videoKycStatus === 'approved' || vendor.videoKycStatus === 'not_required' ? vendor.videoKycStatus : 'pending'
    await prisma.user.update({
      where: { id: req.params.id },
      data: { vendorStatus: 'approved', role: 'partner', vendorApprovedAt: new Date(), vendorRejectionReason: '', videoKycStatus },
    })
    res.json({ message: 'Vendor approved' })
  } catch (error) { next(error) }
}

export const rejectAdminVendor = async (req, res, next) => {
  try {
    const { reason } = req.body
    if (!reason?.trim()) return res.status(400).json({ message: 'Rejection reason is required' })
    const vendor = await prisma.user.findUnique({ where: { id: req.params.id } })
    if (!vendor) return res.status(404).json({ message: 'Vendor not found' })
    await prisma.user.update({ where: { id: req.params.id }, data: { vendorStatus: 'rejected', vendorRejectionReason: reason.trim() } })
    res.json({ message: 'Vendor rejected' })
  } catch (error) { next(error) }
}

export const getAdminVehicle = async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id }, include: { owner: { select: { id: true, name: true, email: true } } } })
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })
    res.json({ vehicle: { ...vehicle, ownerName: vehicle.owner?.name, ownerEmail: vehicle.owner?.email } })
  } catch (error) { next(error) }
}

export const approveAdminVehicle = async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { id: req.params.id }, select: { ownerId: true } })
    if (!vehicle) return res.status(404).json({ message: 'Vehicle not found' })
    await prisma.vehicle.update({ where: { id: req.params.id }, data: { status: 'approved', rejectionReason: '' } })
    await prisma.user.update({ where: { id: vehicle.ownerId }, data: { vehicleId: req.params.id } })
    res.json({ message: 'Vehicle approved' })
  } catch (error) { next(error) }
}

export const rejectAdminVehicle = async (req, res, next) => {
  try {
    const { reason } = req.body
    if (!reason?.trim()) return res.status(400).json({ message: 'Rejection reason is required' })
    await prisma.vehicle.update({ where: { id: req.params.id }, data: { status: 'rejected', rejectionReason: reason.trim() } })
    res.json({ message: 'Vehicle rejected' })
  } catch (error) { next(error) }
}

export const getPendingVideoKyc = async (req, res, next) => {
  try {
    const vendors = await prisma.user.findMany({
      where: { role: { in: ['vendor', 'partner'] }, videoKycStatus: 'pending' },
      select: { id: true, name: true, email: true, videoKycStatus: true, videoKycRoomId: true },
    })
    res.json(vendors.map((v) => ({ _id: v.id, name: v.name, email: v.email, videoKycStatus: v.videoKycStatus, videoKycRoomId: v.videoKycRoomId })))
  } catch (error) { next(error) }
}

export const startVideoKyc = async (req, res, next) => {
  try {
    const roomId = `kyc-${req.params.vendorId}-${Date.now()}`
    await prisma.user.update({ where: { id: req.params.vendorId }, data: { videoKycStatus: 'in_progress', videoKycRoomId: roomId } })
    res.json({ roomId })
  } catch (error) { next(error) }
}

export const completeVideoKyc = async (req, res, next) => {
  try {
    const { vendorId, decision, reason } = req.body
    if (!vendorId || !['approved', 'rejected'].includes(decision)) return res.status(400).json({ message: 'vendorId and decision (approved|rejected) are required' })
    const data = decision === 'approved'
      ? { videoKycStatus: 'approved', videoKycRoomId: null }
      : { videoKycStatus: 'rejected', videoKycRejectionReason: reason || '', videoKycRoomId: null }
    await prisma.user.update({ where: { id: vendorId }, data })
    res.json({ message: `Video KYC ${decision}` })
  } catch (error) { next(error) }
}
