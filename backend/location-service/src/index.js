import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import prisma from '../../shared/database/index.js'

const app = express()
const PORT = process.env.PORT || 5005
const INTERNAL_SERVICE_TOKEN = process.env.INTERNAL_SERVICE_TOKEN

app.use(cors())
app.use(express.json())

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversineMetres(lat1, lng1, lat2, lng2) {
  const R = 6371000
  const dLat = (lat2 - lat1) * Math.PI / 180
  const dLng = (lng2 - lng1) * Math.PI / 180
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ─── Middleware ───────────────────────────────────────────────────────────────

function internal(allowedRoles = []) {
  return (req, res, next) => {
    const token = req.headers['x-internal-service-token']
    if (!token || token !== INTERNAL_SERVICE_TOKEN) {
      return res.status(401).json({ error: 'Unauthorized: invalid internal service token' })
    }

    const userId = req.headers['x-user-id']
    const userRole = req.headers['x-user-role']

    if (!userId || !userRole) {
      return res.status(401).json({ error: 'Unauthorized: missing user identity headers' })
    }

    if (allowedRoles.length > 0 && !allowedRoles.includes(userRole)) {
      return res.status(403).json({ error: `Forbidden: role '${userRole}' not permitted` })
    }

    req.userId = userId
    req.userRole = userRole
    next()
  }
}

function internalTokenOnly(req, res, next) {
  const token = req.headers['x-internal-service-token']
  if (!token || token !== INTERNAL_SERVICE_TOKEN) {
    return res.status(401).json({ error: 'Unauthorized: invalid internal service token' })
  }
  next()
}

// ─── Routes ──────────────────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'location-service', timestamp: new Date().toISOString() })
})

// GET /api/vehicles/nearby
app.get('/api/vehicles/nearby', internal(['user', 'admin']), async (req, res, next) => {
  try {
    const lat = parseFloat(req.query.lat)
    const lng = parseFloat(req.query.lng)

    if (!isFinite(lat) || !isFinite(lng)) {
      return res.status(400).json({ error: 'lat and lng query parameters are required and must be valid numbers' })
    }

    const radius = Math.min(parseFloat(req.query.radius) || 5000, 50000)
    const type = req.query.type || null

    const whereClause = {
      isOnline: true,
      role: { in: ['vendor', 'partner'] },
      vendorStatus: 'approved',
      isVendorBlocked: false,
    }

    if (type) {
      whereClause.currentVehicleType = type
    }

    const drivers = await prisma.user.findMany({
      where: whereClause,
      select: {
        id: true,
        name: true,
        locationLat: true,
        locationLng: true,
        currentVehicleType: true,
        isOnline: true,
        ownedVehicle: {
          select: {
            type: true,
            vehicleModel: true,
            baseFare: true,
            pricePerKM: true,
            waitingCharge: true,
            imageUrl: true,
          },
        },
      },
    })

    const nearby = drivers
      .filter(d => d.locationLat != null && d.locationLng != null)
      .map(d => {
        const distance = haversineMetres(lat, lng, d.locationLat, d.locationLng)
        return { driver: d, distance }
      })
      .filter(({ distance }) => distance <= radius)
      .sort((a, b) => a.distance - b.distance)
      .slice(0, 20)
      .map(({ driver: d, distance }) => ({
        driverId: d.id,
        name: d.name,
        distance: Math.round(distance),
        lat: d.locationLat,
        lng: d.locationLng,
        vehicleType: d.currentVehicleType,
        vehicle: d.ownedVehicle
          ? {
              type: d.ownedVehicle.type,
              model: d.ownedVehicle.vehicleModel,
              baseFare: d.ownedVehicle.baseFare,
              pricePerKM: d.ownedVehicle.pricePerKM,
              waitingCharge: d.ownedVehicle.waitingCharge,
              imageUrl: d.ownedVehicle.imageUrl,
            }
          : null,
      }))

    res.json(nearby)
  } catch (err) {
    next(err)
  }
})

// PATCH /api/driver/location
app.patch('/api/driver/location', internal(['vendor', 'partner']), async (req, res, next) => {
  try {
    const { latitude, longitude } = req.body

    if (!isFinite(latitude) || !isFinite(longitude)) {
      return res.status(400).json({ error: 'latitude and longitude must be finite numbers' })
    }
    if (latitude < -90 || latitude > 90) {
      return res.status(400).json({ error: 'latitude must be between -90 and 90' })
    }
    if (longitude < -180 || longitude > 180) {
      return res.status(400).json({ error: 'longitude must be between -180 and 180' })
    }

    const now = new Date()
    const updated = await prisma.user.update({
      where: { id: req.userId },
      data: {
        locationLat: latitude,
        locationLng: longitude,
        lastLocationUpdate: now,
        isOnline: true,
      },
      select: {
        locationLat: true,
        locationLng: true,
        lastLocationUpdate: true,
      },
    })

    res.json({
      success: true,
      lat: updated.locationLat,
      lng: updated.locationLng,
      updatedAt: updated.lastLocationUpdate,
    })
  } catch (err) {
    next(err)
  }
})

// GET /api/driver/:id/location
app.get('/api/driver/:id/location', internal([]), async (req, res, next) => {
  try {
    const driver = await prisma.user.findUnique({
      where: { id: req.params.id },
      select: {
        id: true,
        locationLat: true,
        locationLng: true,
        isOnline: true,
        lastLocationUpdate: true,
        currentVehicleType: true,
      },
    })

    if (!driver) {
      return res.status(404).json({ error: 'Driver not found' })
    }

    res.json({
      driverId: driver.id,
      lat: driver.locationLat,
      lng: driver.locationLng,
      isOnline: driver.isOnline,
      lastLocationUpdate: driver.lastLocationUpdate,
      currentVehicleType: driver.currentVehicleType,
    })
  } catch (err) {
    next(err)
  }
})

// POST /api/driver/online
app.post('/api/driver/online', internal(['vendor', 'partner']), async (req, res, next) => {
  try {
    const { vehicleType } = req.body
    const validTypes = ['bike', 'car', 'auto', 'loading', 'truck']

    if (!vehicleType || !validTypes.includes(vehicleType)) {
      return res.status(400).json({ error: `vehicleType must be one of: ${validTypes.join(', ')}` })
    }

    await prisma.user.update({
      where: { id: req.userId },
      data: {
        isOnline: true,
        currentVehicleType: vehicleType,
      },
    })

    res.json({ success: true, isOnline: true, currentVehicleType: vehicleType })
  } catch (err) {
    next(err)
  }
})

// POST /api/driver/offline
app.post('/api/driver/offline', internal(['vendor', 'partner']), async (req, res, next) => {
  try {
    await prisma.user.update({
      where: { id: req.userId },
      data: {
        isOnline: false,
        currentVehicleType: null,
      },
    })

    res.json({ success: true, isOnline: false })
  } catch (err) {
    next(err)
  }
})

// POST /api/internal/location/cleanup
app.post('/api/internal/location/cleanup', internalTokenOnly, async (req, res, next) => {
  try {
    const cutoff = new Date(Date.now() - 5 * 60 * 1000) // 5 minutes ago

    const result = await prisma.user.updateMany({
      where: {
        isOnline: true,
        lastLocationUpdate: { lt: cutoff },
      },
      data: {
        isOnline: false,
      },
    })

    res.json({ success: true, deactivated: result.count })
  } catch (err) {
    next(err)
  }
})

// ─── Error Handler ────────────────────────────────────────────────────────────

app.use((error, _req, res, _next) => {
  console.error('[location-service]', error)
  res.status(500).json({ error: 'Location service request failed' })
})

// ─── Start ────────────────────────────────────────────────────────────────────

app.listen(PORT, () => {
  console.log(`[location-service] running on port ${PORT}`)
})
