import prisma from '../lib/db.js'
import { imageUrl } from '../lib/cloudinary.js'

/** Shared helper — strips sensitive fields and returns a consistent pricing shape. */
function pricingShape(vehicle) {
  return {
    baseFare: vehicle.baseFare,
    pricePerKm: vehicle.pricePerKM,
    waitingCharge: vehicle.waitingCharge,
    imageUrl: vehicle.imageUrl,
    status: vehicle.status,
    rejectionReason: vehicle.rejectionReason,
  }
}

// ---------------------------------------------------------------------------
// GET /api/partner/vehicle
// ---------------------------------------------------------------------------
export async function getVehicle(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.actor.userId },
      include: { ownedVehicle: true },
    })
    if (!user) return res.status(404).json({ error: 'User not found' })
    const { password, otp, otpExpiry, ownedVehicle, ...safeUser } = user
    res.json({ user: safeUser, vehicle: ownedVehicle })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/partner/vehicle
// ---------------------------------------------------------------------------
export async function createVehicle(req, res, next) {
  try {
    const { type, number, vehicleModel } = req.body
    if (!type || !number?.trim() || !vehicleModel?.trim()) {
      return res.status(400).json({ message: 'type, number and vehicleModel are required' })
    }
    if (!['bike', 'car', 'loading', 'truck', 'auto'].includes(type)) {
      return res.status(400).json({ message: 'Unsupported vehicle type' })
    }
    const vehicle = await prisma.vehicle.upsert({
      where: { ownerId: req.actor.userId },
      update: { type, number: number.trim().toUpperCase(), vehicleModel: vehicleModel.trim() },
      create: { ownerId: req.actor.userId, type, number: number.trim().toUpperCase(), vehicleModel: vehicleModel.trim() },
    })
    await prisma.user.update({
      where: { id: req.actor.userId },
      data: { role: 'vendor', vendorOnboardingStep: { set: 1 } },
    })
    res.json({ vehicle })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/partner/documents
// ---------------------------------------------------------------------------
export async function getDocuments(req, res, next) {
  try {
    const documents = await prisma.partnerDocs.findUnique({ where: { ownerId: req.actor.userId } })
    res.json({ documents })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/partner/documents   (multer upload.fields handled in route)
// ---------------------------------------------------------------------------
export async function uploadDocuments(req, res, next) {
  try {
    const files = req.files || {}
    const [aadharUrl, licenseUrl, rcUrl] = await Promise.all([
      imageUrl(files.aadhaar?.[0], `rydex/vendor-documents/${req.actor.userId}`),
      imageUrl(files.license?.[0], `rydex/vendor-documents/${req.actor.userId}`),
      imageUrl(files.rc?.[0], `rydex/vendor-documents/${req.actor.userId}`),
    ])
    if (!aadharUrl || !licenseUrl || !rcUrl) {
      return res.status(400).json({ message: 'aadhaar, license and rc files are required' })
    }
    const documents = await prisma.partnerDocs.upsert({
      where: { ownerId: req.actor.userId },
      update: { aadharUrl, licenseUrl, rcUrl, status: 'pending', rejectionReason: '' },
      create: { ownerId: req.actor.userId, aadharUrl, licenseUrl, rcUrl },
    })
    await prisma.user.update({
      where: { id: req.actor.userId },
      data: { vendorOnboardingStep: { set: 2 } },
    })
    res.json({ documents })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/partner/bank
// ---------------------------------------------------------------------------
export async function getBank(req, res, next) {
  try {
    const bank = await prisma.partnerBank.findUnique({ where: { ownerId: req.actor.userId } })
    res.json({ bank: bank ? { ...bank, accountHolderName: bank.accountHolder } : null })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/partner/bank
// ---------------------------------------------------------------------------
export async function saveBank(req, res, next) {
  try {
    const { name, account, ifsc, upi, mobileNumber } = req.body
    if (![name, account, ifsc, mobileNumber].every((v) => typeof v === 'string' && v.trim())) {
      return res.status(400).json({ message: 'name, account, ifsc, and mobileNumber are required' })
    }
    const bank = await prisma.partnerBank.upsert({
      where: { ownerId: req.actor.userId },
      update: {
        accountHolder: name.trim(),
        accountNumber: account.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        upi: upi?.trim() || null,
        mobileNumber: mobileNumber.trim(),
        status: 'added',
      },
      create: {
        ownerId: req.actor.userId,
        accountHolder: name.trim(),
        accountNumber: account.trim(),
        ifsc: ifsc.trim().toUpperCase(),
        upi: upi?.trim() || null,
        mobileNumber: mobileNumber.trim(),
        status: 'added',
      },
    })
    await prisma.user.update({
      where: { id: req.actor.userId },
      data: { vendorOnboardingStep: { set: 3 } },
    })
    res.json({ bank })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/partner/review
// ---------------------------------------------------------------------------
export async function getReview(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.actor.userId },
      select: {
        id: true,
        name: true,
        email: true,
        vendorStatus: true,
        vendorRejectionReason: true,
        ownedVehicle: true,
        partnerDocs: true,
        partnerBank: true,
      },
    })
    if (!user) return res.status(404).json({ message: 'Vendor not found' })
    const { ownedVehicle, partnerDocs, partnerBank, ...rest } = user
    res.json({
      vendor: {
        _id: user.id,
        ...rest,
        vehicle: ownedVehicle
          ? { type: ownedVehicle.type, number: ownedVehicle.number, model: ownedVehicle.vehicleModel }
          : null,
        documents: partnerDocs
          ? {
              aadhaarUrl: partnerDocs.aadharUrl,
              licenseUrl: partnerDocs.licenseUrl,
              rcUrl: partnerDocs.rcUrl,
              status: partnerDocs.status,
              rejectionReason: partnerDocs.rejectionReason,
            }
          : null,
        bank: partnerBank
          ? { accountHolderName: partnerBank.accountHolder, ifsc: partnerBank.ifsc, upi: partnerBank.upi, status: partnerBank.status }
          : null,
      },
    })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/partner/resubmit
// ---------------------------------------------------------------------------
export async function resubmit(req, res, next) {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.actor.userId },
      select: { vendorStatus: true },
    })
    if (!user) return res.status(404).json({ message: 'User not found' })
    if (user.vendorStatus !== 'rejected') {
      return res.status(400).json({ message: 'Application is not in rejected state' })
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: req.actor.userId },
        data: { vendorStatus: 'pending', vendorRejectionReason: '' },
      }),
      prisma.partnerDocs.updateMany({
        where: { ownerId: req.actor.userId },
        data: { status: 'pending', rejectionReason: '' },
      }),
      prisma.partnerBank.updateMany({
        where: { ownerId: req.actor.userId },
        data: { status: 'added' },
      }),
    ])
    res.json({ message: 'Application resubmitted successfully' })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// GET /api/partner/vehicle/pricing
// ---------------------------------------------------------------------------
export async function getVehiclePricing(req, res, next) {
  try {
    const vehicle = await prisma.vehicle.findUnique({ where: { ownerId: req.actor.userId } })
    res.json({ pricing: vehicle ? pricingShape(vehicle) : null })
  } catch (error) {
    next(error)
  }
}

// ---------------------------------------------------------------------------
// POST /api/partner/vehicle/pricing  (editOnly=false)
// PATCH /api/partner/vehicle/pricing/edit  (editOnly=true)
// multer upload.single('image') is applied in the route definition
// ---------------------------------------------------------------------------
async function savePricing(req, res, next, editOnly) {
  try {
    const baseFare = Number(req.body.baseFare)
    const pricePerKM = Number(req.body.pricePerKm)
    const waitingCharge = Number(req.body.waitingCharge)
    if (!Number.isFinite(baseFare) || baseFare <= 0) {
      return res.status(400).json({ message: 'Base Fare must be greater than 0' })
    }
    if (!Number.isFinite(pricePerKM) || pricePerKM <= 0) {
      return res.status(400).json({ message: 'Price per KM must be greater than 0' })
    }
    if (!Number.isFinite(waitingCharge) || waitingCharge < 0) {
      return res.status(400).json({ message: 'Waiting charge cannot be negative' })
    }
    const existing = await prisma.vehicle.findUnique({ where: { ownerId: req.actor.userId } })
    if (!existing) {
      return res.status(404).json({ message: 'Vehicle not found. Complete vehicle registration first.' })
    }
    if (editOnly && existing.status !== 'rejected') {
      return res.status(403).json({ message: 'Pricing can only be edited after rejection' })
    }
    const image = req.file?.size
      ? await imageUrl(req.file, `rydex/vehicle-images/${req.actor.userId}`)
      : existing.imageUrl
    const vehicle = await prisma.vehicle.update({
      where: { ownerId: req.actor.userId },
      data: { baseFare, pricePerKM, waitingCharge, imageUrl: image, status: 'pending', rejectionReason: '' },
    })
    if (!editOnly) {
      await prisma.user.update({
        where: { id: req.actor.userId },
        data: { vendorOnboardingStep: { set: 6 } },
      })
    }
    res.json({ pricing: pricingShape(vehicle) })
  } catch (error) {
    next(error)
  }
}

export const submitVehiclePricing = (req, res, next) => savePricing(req, res, next, false)
export const editVehiclePricing = (req, res, next) => savePricing(req, res, next, true)

// ---------------------------------------------------------------------------
// GET /api/partner/earnings
// ---------------------------------------------------------------------------
export async function getEarnings(req, res, next) {
  try {
    const days = Math.max(1, Math.min(Number(req.query.days) || 7, 90))
    const since = new Date()
    since.setDate(since.getDate() - days + 1)
    since.setHours(0, 0, 0, 0)
    const rows = await prisma.booking.findMany({
      where: { vendorId: req.actor.userId, status: 'completed', completedAt: { gte: since } },
      select: { fare: true, completedAt: true },
    })
    const byDay = new Map()
    for (const booking of rows) {
      const key = booking.completedAt.toISOString().slice(0, 10)
      const current = byDay.get(key) || { earnings: 0, trips: 0 }
      current.earnings += booking.fare
      current.trips += 1
      byDay.set(key, current)
    }
    const labels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const earnings = Array.from({ length: days }, (_, index) => {
      const date = new Date(since)
      date.setDate(date.getDate() + index)
      const key = date.toISOString().slice(0, 10)
      const totals = byDay.get(key) || { earnings: 0, trips: 0 }
      return { date: days <= 7 ? labels[date.getDay()] : key.slice(5), ...totals }
    })
    const total = earnings.reduce((sum, day) => sum + day.earnings, 0)
    res.json({
      earnings,
      summary: {
        total,
        avg: Math.round(total / days),
        max: Math.max(0, ...earnings.map((day) => day.earnings)),
        totalTrips: rows.length,
      },
      demo: false,
    })
  } catch (error) {
    next(error)
  }
}
