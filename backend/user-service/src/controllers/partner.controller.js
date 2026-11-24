import prisma from '../lib/db.js'
import { uploadBuffer } from '../lib/upload.js'
import { DAY_LABELS, demoEarnings } from './helpers.js'

export const getPartnerProfile = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, include: { ownedVehicle: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { password, otp, otpExpiry, ownedVehicle, ...safeUser } = user
    res.json({ user: safeUser, vehicle: ownedVehicle ?? null })
  } catch (error) { next(error) }
}

export const getPartnerReview = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.actor.userId },
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

export const resubmitPartnerApplication = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, select: { vendorStatus: true } })
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.vendorStatus !== 'rejected') return res.status(400).json({ message: 'Application is not in rejected state' })
    await Promise.all([
      prisma.user.update({ where: { id: req.actor.userId }, data: { vendorStatus: 'pending', vendorRejectionReason: '' } }),
      prisma.vehicle.update({ where: { ownerId: req.actor.userId }, data: { status: 'pending', rejectionReason: '' } }).catch(() => {}),
      prisma.partnerDocs.update({ where: { ownerId: req.actor.userId }, data: { status: 'pending', rejectionReason: '' } }).catch(() => {}),
      prisma.partnerBank.update({ where: { ownerId: req.actor.userId }, data: { status: 'verified' } }).catch(() => {}),
    ])
    res.json({ message: 'Application resubmitted successfully' })
  } catch (error) { next(error) }
}

export const getPartnerVehicle = async (req, res, next) => {
  try {
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, include: { ownedVehicle: true } })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { password, otp, otpExpiry, ownedVehicle, ...safeUser } = user
    res.json({ user: safeUser, vehicle: ownedVehicle ?? null })
  } catch (error) { next(error) }
}

export const upsertPartnerVehicle = async (req, res, next) => {
  try {
    const { type, number, vehicleModel } = req.body
    if (!type || !number || !vehicleModel) return res.status(400).json({ message: 'type, number and vehicleModel are required' })
    const vehicle = await prisma.vehicle.upsert({
      where: { ownerId: req.actor.userId },
      update: { type, number, vehicleModel },
      create: { ownerId: req.actor.userId, type, number, vehicleModel },
    })
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, select: { vendorOnboardingStep: true } })
    if (user && user.vendorOnboardingStep < 1) {
      await prisma.user.update({ where: { id: req.actor.userId }, data: { role: 'vendor', vendorOnboardingStep: 1 } })
    } else {
      await prisma.user.update({ where: { id: req.actor.userId }, data: { role: 'vendor' } })
    }
    res.json({ vehicle })
  } catch (error) {
    if (error?.code === 'P2002') return res.status(409).json({ message: 'Vehicle number already registered' })
    next(error)
  }
}

export const getPartnerVehiclePricing = async (req, res, next) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { ownerId: req.actor.userId },
      select: { baseFare: true, pricePerKM: true, waitingCharge: true, imageUrl: true, status: true, rejectionReason: true },
    })
    if (!vehicle) return res.json({ pricing: null })
    res.json({ pricing: { baseFare: vehicle.baseFare, pricePerKm: vehicle.pricePerKM, waitingCharge: vehicle.waitingCharge, imageUrl: vehicle.imageUrl, status: vehicle.status, rejectionReason: vehicle.rejectionReason } })
  } catch (error) { next(error) }
}

export const submitPartnerVehiclePricing = async (req, res, next) => {
  try {
    const baseFare = Number(req.body.baseFare)
    const pricePerKm = Number(req.body.pricePerKm)
    const waitingCharge = Number(req.body.waitingCharge)
    if (!baseFare || baseFare <= 0) return res.status(400).json({ message: 'Base Fare must be greater than 0' })
    if (!pricePerKm || pricePerKm <= 0) return res.status(400).json({ message: 'Price per KM must be greater than 0' })
    if (waitingCharge < 0) return res.status(400).json({ message: 'Waiting charge cannot be negative' })
    const existing = await prisma.vehicle.findUnique({ where: { ownerId: req.actor.userId }, select: { imageUrl: true } })
    if (!existing) return res.status(404).json({ message: 'Vehicle not found. Complete vehicle registration first.' })
    let imageUrl = existing.imageUrl
    if (req.file) imageUrl = await uploadBuffer(req.file.buffer, `rydex/vehicle-images/${req.actor.userId}`)
    const vehicle = await prisma.vehicle.update({
      where: { ownerId: req.actor.userId },
      data: { baseFare, pricePerKM: pricePerKm, waitingCharge, imageUrl, status: 'pending', rejectionReason: '' },
      select: { baseFare: true, pricePerKM: true, waitingCharge: true, imageUrl: true, status: true, rejectionReason: true },
    })
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, select: { vendorOnboardingStep: true } })
    if (user && user.vendorOnboardingStep < 6) await prisma.user.update({ where: { id: req.actor.userId }, data: { vendorOnboardingStep: 6 } })
    res.json({ pricing: { baseFare: vehicle.baseFare, pricePerKm: vehicle.pricePerKM, waitingCharge: vehicle.waitingCharge, imageUrl: vehicle.imageUrl, status: vehicle.status, rejectionReason: vehicle.rejectionReason } })
  } catch (error) { next(error) }
}

export const updatePartnerVehiclePricing = async (req, res, next) => {
  try {
    const baseFare = req.body.baseFare ? Number(req.body.baseFare) : undefined
    const pricePerKm = req.body.pricePerKm ? Number(req.body.pricePerKm) : undefined
    const waitingCharge = req.body.waitingCharge !== undefined ? Number(req.body.waitingCharge) : undefined
    const existing = await prisma.vehicle.findUnique({ where: { ownerId: req.actor.userId }, select: { imageUrl: true, status: true } })
    if (!existing) return res.status(404).json({ message: 'Vehicle not found' })
    let imageUrl = existing.imageUrl
    if (req.file) imageUrl = await uploadBuffer(req.file.buffer, `rydex/vehicle-images/${req.actor.userId}`)
    const updateData = {}
    if (baseFare !== undefined) updateData.baseFare = baseFare
    if (pricePerKm !== undefined) updateData.pricePerKM = pricePerKm
    if (waitingCharge !== undefined) updateData.waitingCharge = waitingCharge
    if (imageUrl !== existing.imageUrl) updateData.imageUrl = imageUrl
    const vehicle = await prisma.vehicle.update({ where: { ownerId: req.actor.userId }, data: updateData, select: { baseFare: true, pricePerKM: true, waitingCharge: true, imageUrl: true, status: true, rejectionReason: true } })
    res.json({ pricing: { baseFare: vehicle.baseFare, pricePerKm: vehicle.pricePerKM, waitingCharge: vehicle.waitingCharge, imageUrl: vehicle.imageUrl, status: vehicle.status, rejectionReason: vehicle.rejectionReason } })
  } catch (error) { next(error) }
}

export const getPartnerDocuments = async (req, res, next) => {
  try {
    const documents = await prisma.partnerDocs.findUnique({ where: { ownerId: req.actor.userId } })
    res.json({ documents: documents ?? null })
  } catch (error) { next(error) }
}

export const savePartnerDocuments = async (req, res, next) => {
  try {
    const files = req.files
    if (!files?.aadhaar?.[0] || !files?.license?.[0] || !files?.rc?.[0]) {
      return res.status(400).json({ message: 'aadhaar, license and rc files are required' })
    }
    const [aadharUrl, licenseUrl, rcUrl] = await Promise.all([
      uploadBuffer(files.aadhaar[0].buffer, `rydex/docs/${req.actor.userId}/aadhaar`),
      uploadBuffer(files.license[0].buffer, `rydex/docs/${req.actor.userId}/license`),
      uploadBuffer(files.rc[0].buffer, `rydex/docs/${req.actor.userId}/rc`),
    ])
    const documents = await prisma.partnerDocs.upsert({
      where: { ownerId: req.actor.userId },
      update: { aadharUrl, licenseUrl, rcUrl, status: 'pending', rejectionReason: '' },
      create: { ownerId: req.actor.userId, aadharUrl, licenseUrl, rcUrl, status: 'pending' },
    })
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, select: { vendorOnboardingStep: true } })
    if (user && user.vendorOnboardingStep < 2) await prisma.user.update({ where: { id: req.actor.userId }, data: { vendorOnboardingStep: 2 } })
    res.json({ documents })
  } catch (error) { next(error) }
}

export const getPartnerBank = async (req, res, next) => {
  try {
    const bank = await prisma.partnerBank.findUnique({ where: { ownerId: req.actor.userId } })
    res.json({ bank: bank ? { ...bank, accountHolderName: bank.accountHolder } : null })
  } catch (error) { next(error) }
}

export const savePartnerBank = async (req, res, next) => {
  try {
    const { name, account, ifsc, upi, mobileNumber } = req.body
    if (!name || !account || !ifsc || !mobileNumber) return res.status(400).json({ message: 'name, account, ifsc, and mobileNumber are required' })
    const bank = await prisma.partnerBank.upsert({
      where: { ownerId: req.actor.userId },
      update: { accountHolder: name, accountNumber: account, ifsc, upi, mobileNumber, status: 'added' },
      create: { ownerId: req.actor.userId, accountHolder: name, accountNumber: account, ifsc, upi, mobileNumber, status: 'added' },
    })
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, select: { vendorOnboardingStep: true } })
    if (user && user.vendorOnboardingStep < 3) await prisma.user.update({ where: { id: req.actor.userId }, data: { vendorOnboardingStep: 3 } })
    res.json({ bank })
  } catch (error) { next(error) }
}

export const getPartnerEarnings = async (req, res, next) => {
  try {
    const days = Math.min(Number(req.query.days || '7'), 90)
    const since = new Date(); since.setDate(since.getDate() - days + 1); since.setHours(0, 0, 0, 0)
    const rows = await prisma.$queryRaw`
      SELECT TO_CHAR("completedAt", 'YYYY-MM-DD') as "_id", COALESCE(SUM(fare), 0) as earnings, COUNT(*)::int as trips
      FROM "Booking" WHERE "vendorId" = ${req.actor.userId} AND "status" = 'completed'::"BookingStatus" AND "completedAt" >= ${since}
      GROUP BY TO_CHAR("completedAt", 'YYYY-MM-DD') ORDER BY "_id" ASC`
    const earningsMap = new Map(rows.map((r) => [r._id, r]))
    const earnings = Array.from({ length: days }, (_, i) => {
      const d = new Date(since); d.setDate(since.getDate() + i)
      const key = d.toISOString().slice(0, 10)
      const label = days <= 7 ? DAY_LABELS[d.getDay()] : key.slice(5)
      const row = earningsMap.get(key)
      return { date: label, earnings: row?.earnings ?? 0, trips: row?.trips ?? 0 }
    })
    if (earnings.every((e) => e.earnings === 0)) return res.json({ earnings: demoEarnings(days, 1800, 900), summary: { total: 0, avg: 0, max: 0 }, demo: true })
    const total = earnings.reduce((s, e) => s + e.earnings, 0)
    res.json({ earnings, summary: { total, avg: Math.round(total / days), max: Math.max(...earnings.map((e) => e.earnings)), totalTrips: earnings.reduce((s, e) => s + e.trips, 0) }, demo: false })
  } catch (error) { next(error) }
}
