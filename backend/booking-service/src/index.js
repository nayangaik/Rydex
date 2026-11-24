import 'dotenv/config'
import express from 'express'
import crypto from 'node:crypto'
import prisma from '../../shared/database/index.js'
import { canTransition, allowedPreviousStatuses } from './lib/bookingTransitions.js'

const app = express()
const PORT = Number(process.env.PORT || 5004)
app.use(express.json({ limit: '1mb' }))

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
const customerOnly = (req, res, next) => ['user', 'admin'].includes(req.actor.role) ? next() : res.status(403).json({ message: 'Customer access required' })
const vendorOnly = (req, res, next) => ['vendor', 'partner', 'admin'].includes(req.actor.role) ? next() : res.status(403).json({ message: 'Vendor access required' })
const health = (_req, res) => res.json({ status: 'ok', service: 'booking-service', ts: new Date().toISOString() })
app.get('/health', health)
app.get('/api/health', health)
app.get('/internal/booking/:id/members/:userId', async (req, res, next) => {
  if (!process.env.INTERNAL_SERVICE_TOKEN || req.get('x-internal-service-token') !== process.env.INTERNAL_SERVICE_TOKEN) return fail(res, 401, 'Unauthorized service request')
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { userId: true, vendorId: true } })
    if (!booking) return fail(res, 404, 'Booking not found')
    res.json({ allowed: [booking.userId, booking.vendorId].includes(req.params.userId) })
  } catch (error) { next(error) }
})
app.post('/internal/booking/:id/location', async (req, res, next) => {
  if (!process.env.INTERNAL_SERVICE_TOKEN || req.get('x-internal-service-token') !== process.env.INTERNAL_SERVICE_TOKEN) return fail(res, 401, 'Unauthorized service request')
  const { latitude, longitude } = req.body || {}
  if (!Number.isFinite(latitude) || !Number.isFinite(longitude) || Math.abs(latitude) > 90 || Math.abs(longitude) > 180) return fail(res, 400, 'Valid latitude and longitude are required')
  try {
    const booking = await prisma.booking.findUnique({ where: { id: req.params.id }, select: { vendorId: true, status: true } })
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.vendorId !== req.get('x-user-id') || !['confirmed', 'started', 'active'].includes(booking.status)) return fail(res, 403, 'Only the assigned driver can update this active ride')
    await prisma.user.update({ where: { id: booking.vendorId }, data: { locationLat: latitude, locationLng: longitude, lastLocationUpdate: new Date() } })
    res.json({ success: true })
  } catch (error) { next(error) }
})
app.use('/api', internal)

const bookingInclude = {
  user: { select: { id: true, name: true, email: true, image: true } },
  vendor: { select: { id: true, name: true, email: true, image: true } },
  vehicle: true,
}
function serialize(booking) {
  if (!booking) return null
  const { vendor, ...rest } = booking
  return { ...rest, _id: booking.id, driver: vendor ?? null }
}
function fail(res, status, message) { return res.status(status).json({ success: false, message }) }
async function emitEvent(booking, event, payload) {
  const base = process.env.SOCKET_SERVER_URL
  if (!base) return
  try {
    const response = await fetch(new URL('/booking-event', base), {
      method: 'POST', headers: { 'content-type': 'application/json', 'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN || '' },
      body: JSON.stringify({ bookingId: booking.id, event, recipients: [booking.userId, booking.vendorId], payload: { ...payload, bookingId: booking.id } }), signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) console.warn(`[booking-service] socket event rejected (${response.status}):`, await response.text())
  } catch (error) { console.warn('[booking-service] socket event delivery failed:', error.message) }
}
async function emitUpdated(booking) {
  const data = { bookingId: booking.id, status: booking.status, paymentStatus: booking.paymentStatus }
  await emitEvent(booking, 'booking-updated', data)
  if (booking.status === 'started') await emitEvent(booking, 'ride-started', data)
  if (booking.status === 'completed') await emitEvent(booking, 'ride-completed', data)
  if (booking.paymentStatus !== 'pending') await emitEvent(booking, 'payment-updated', { ...data, paymentMethod: booking.paymentMethod })
}
function validPoint(value) {
  return value && value.type === 'Point' && Array.isArray(value.coordinates) && value.coordinates.length === 2 && value.coordinates.every(Number.isFinite)
}
async function getBooking(id) {
  return prisma.booking.findUnique({ where: { id }, include: bookingInclude })
}
function actorCanRead(booking, actor) {
  return actor.role === 'admin' || booking.userId === actor.userId || booking.vendorId === actor.userId
}
async function updateStatus(booking, status, extra = {}) {
  if (!canTransition(booking.status, status)) throw Object.assign(new Error(`Cannot transition booking from ${booking.status} to ${status}`), { statusCode: 409 })
  const result = await prisma.booking.updateMany({ where: { id: booking.id, status: { in: allowedPreviousStatuses(status) } }, data: { status, ...extra } })
  if (!result.count) throw Object.assign(new Error('Booking changed before this action could be applied'), { statusCode: 409 })
  const updated = await getBooking(booking.id)
  await emitUpdated(updated)
  return updated
}

// Customer checkout: create a request for an approved vehicle/vendor.
app.post('/api/booking/create', customerOnly, async (req, res, next) => {
  try {
    const { vehicleId, driverId, pickupAddress, dropAddress, pickupLocation, dropLocation, fare, mobileNumber } = req.body
    if (!vehicleId || !pickupAddress?.trim() || !dropAddress?.trim() || !Number.isFinite(Number(fare)) || Number(fare) <= 0) return fail(res, 400, 'vehicleId, pickup/drop addresses and a positive fare are required')
    if (!validPoint(pickupLocation) || !validPoint(dropLocation)) return fail(res, 400, 'Valid pickupLocation and dropLocation GeoJSON points are required')
    const vehicle = await prisma.vehicle.findUnique({ where: { id: vehicleId }, include: { owner: { select: { id: true, name: true, role: true, vendorStatus: true, isVendorBlocked: true, partnerBank: { select: { mobileNumber: true } } } } } })
    if (!vehicle || vehicle.status !== 'approved' || vehicle.owner.vendorStatus !== 'approved' || vehicle.owner.isVendorBlocked) return fail(res, 404, 'Selected vehicle is unavailable')
    if (driverId && driverId !== vehicle.ownerId) return fail(res, 400, 'Selected driver does not own this vehicle')
    const user = await prisma.user.findUnique({ where: { id: req.actor.userId }, select: { name: true, email: true } })
    if (!user) return fail(res, 404, 'Customer not found')
    const existing = await prisma.booking.findFirst({ where: { userId: req.actor.userId, status: { in: ['requested', 'awaiting_payment', 'confirmed', 'pending', 'active'] } } })
    if (existing) return fail(res, 409, 'You already have an active booking')
    const booking = await prisma.booking.create({
      data: {
        userId: req.actor.userId, vendorId: vehicle.ownerId, vehicleId, fare: Number(fare), status: 'requested',
        pickupAddress: pickupAddress.trim(), dropAddress: dropAddress.trim(), pickupLocation, dropLocation,
        userMobileNumber: typeof mobileNumber === 'string' ? mobileNumber.trim() : '',
        driverMobileNumber: vehicle.owner.partnerBank?.mobileNumber || '',
        paymentStatus: 'pending', paymentDeadline: new Date(Date.now() + 10 * 60 * 1000),
      }, include: bookingInclude,
    })
    await emitEvent(booking, 'new-booking', serialize(booking))
    res.status(201).json({ success: true, booking: serialize(booking) })
  } catch (error) { next(error) }
})

// Customer and vendor booking reads.
app.get('/api/booking/my-active', customerOnly, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { userId: req.actor.userId, status: { in: ['requested', 'awaiting_payment', 'confirmed', 'started', 'pending', 'active'] } }, orderBy: { createdAt: 'desc' }, include: bookingInclude })
    res.json({ booking: serialize(booking) })
  } catch (error) { next(error) }
})
app.get('/api/booking/:id', async (req, res, next) => {
  try {
    const booking = await getBooking(req.params.id)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (!actorCanRead(booking, req.actor)) return fail(res, 403, 'You cannot view this booking')
    res.json(serialize(booking))
  } catch (error) { next(error) }
})
app.get('/api/user/bookings', customerOnly, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({ where: { userId: req.actor.userId }, orderBy: { createdAt: 'desc' }, take: 100, include: bookingInclude })
    res.json({ bookings: bookings.map(serialize) })
  } catch (error) { next(error) }
})
app.get('/api/partner/bookings', vendorOnly, async (req, res, next) => {
  try {
    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1)
    const limit = Math.min(100, Math.max(1, Number.parseInt(req.query.limit, 10) || 20))
    const status = String(req.query.status || 'all')
    const where = { vendorId: req.actor.userId }
    if (status !== 'all') {
      if (!['requested', 'awaiting_payment', 'confirmed', 'started', 'completed', 'cancelled', 'rejected', 'expired', 'pending', 'active'].includes(status)) return fail(res, 400, 'Unsupported booking status')
      where.status = status
    }
    const [bookings, total] = await Promise.all([
      prisma.booking.findMany({ where, orderBy: { createdAt: 'desc' }, skip: (page - 1) * limit, take: limit, include: bookingInclude }),
      prisma.booking.count({ where }),
    ])
    res.json({ bookings: bookings.map(serialize), page, limit, total })
  } catch (error) { next(error) }
})
app.get('/api/partner/bookings/pending', vendorOnly, async (req, res, next) => {
  try {
    const bookings = await prisma.booking.findMany({ where: { vendorId: req.actor.userId, status: { in: ['requested', 'pending'] } }, orderBy: { createdAt: 'asc' }, include: bookingInclude })
    res.json({ bookings: bookings.map(serialize) })
  } catch (error) { next(error) }
})
app.get('/api/partner/bookings/active', vendorOnly, async (req, res, next) => {
  try {
    const booking = await prisma.booking.findFirst({ where: { vendorId: req.actor.userId, status: { in: ['confirmed', 'started', 'active'] } }, orderBy: { updatedAt: 'desc' }, include: bookingInclude })
    res.json(serialize(booking))
  } catch (error) { next(error) }
})
app.get('/api/partner/bookings/counts', vendorOnly, async (req, res, next) => {
  try {
    const [pending, active, completed] = await Promise.all([
      prisma.booking.count({ where: { vendorId: req.actor.userId, status: { in: ['requested', 'pending'] } } }),
      prisma.booking.count({ where: { vendorId: req.actor.userId, status: { in: ['confirmed', 'started', 'active'] } } }),
      prisma.booking.count({ where: { vendorId: req.actor.userId, status: 'completed' } }),
    ])
    res.json({ pending, active, completed, total: pending + active + completed })
  } catch (error) { next(error) }
})
app.get('/api/admin/earnings', async (req, res, next) => {
  try {
    if (req.actor.role !== 'admin') return fail(res, 403, 'Admin access required')
    const days = Math.max(1, Math.min(Number.parseInt(req.query.days, 10) || 7, 90))
    const since = new Date(); since.setDate(since.getDate() - days + 1); since.setHours(0, 0, 0, 0)
    const completed = await prisma.booking.findMany({ where: { status: 'completed', completedAt: { gte: since } }, select: { fare: true, completedAt: true } })
    const byDay = new Map()
    for (const booking of completed) {
      const key = booking.completedAt.toISOString().slice(0, 10)
      byDay.set(key, (byDay.get(key) || 0) + booking.fare)
    }
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const earnings = Array.from({ length: days }, (_, index) => {
      const date = new Date(since); date.setDate(date.getDate() + index)
      const key = date.toISOString().slice(0, 10)
      return { date: days <= 7 ? weekdays[date.getDay()] : key.slice(5), earnings: byDay.get(key) || 0 }
    })
    const total = earnings.reduce((sum, day) => sum + day.earnings, 0)
    res.json({ earnings, summary: { total, avg: Math.round(total / days), max: Math.max(0, ...earnings.map((day) => day.earnings)) }, demo: false })
  } catch (error) { next(error) }
})

// Partner decisions and customer cancellation.
app.post('/api/booking/:id/accept', vendorOnly, async (req, res, next) => {
  try {
    const booking = await getBooking(req.params.id)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.vendorId !== req.actor.userId && req.actor.role !== 'admin') return fail(res, 403, 'You cannot accept this booking')
    if (!['requested', 'pending'].includes(booking.status)) return fail(res, 409, 'Booking is no longer awaiting a response')
    const updated = await updateStatus(booking, 'awaiting_payment', { paymentDeadline: new Date(Date.now() + 10 * 60 * 1000) })
    res.json({ success: true, booking: serialize(updated) })
  } catch (error) { next(error) }
})
app.post('/api/booking/:id/reject', vendorOnly, async (req, res, next) => {
  try {
    const booking = await getBooking(req.params.id)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.vendorId !== req.actor.userId && req.actor.role !== 'admin') return fail(res, 403, 'You cannot reject this booking')
    if (!['requested', 'pending'].includes(booking.status)) return fail(res, 409, 'Booking is no longer awaiting a response')
    const updated = await updateStatus(booking, 'rejected')
    res.json({ success: true, booking: serialize(updated) })
  } catch (error) { next(error) }
})
app.post('/api/booking/:id/cancel', async (req, res, next) => {
  try {
    const booking = await getBooking(req.params.id)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.userId !== req.actor.userId && req.actor.role !== 'admin') return fail(res, 403, 'You cannot cancel this booking')
    if (!['requested', 'awaiting_payment', 'confirmed', 'pending'].includes(booking.status)) return fail(res, 409, 'This booking can no longer be cancelled')
    const updated = await updateStatus(booking, 'cancelled')
    res.json({ success: true, booking: serialize(updated) })
  } catch (error) { next(error) }
})

// Payment: cash confirmation or Razorpay order/signature verification.
app.post('/api/booking/:id/confirm-payment', customerOnly, async (req, res, next) => {
  try {
    const booking = await getBooking(req.params.id)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.userId !== req.actor.userId) return fail(res, 403, 'You cannot pay for this booking')
    if (req.body.method !== 'cash') return fail(res, 400, 'Only cash confirmation is supported on this route')
    if (!['awaiting_payment', 'requested'].includes(booking.status)) return fail(res, 409, 'Booking is not awaiting payment')
    const updated = await updateStatus(booking, 'confirmed', { paymentStatus: 'cash', paymentMethod: 'cash', paymentDeadline: null })
    res.json({ success: true, booking: serialize(updated) })
  } catch (error) { next(error) }
})
app.post('/api/payment/create', customerOnly, async (req, res, next) => {
  try {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) return fail(res, 503, 'Online payments are not configured')
    const booking = await getBooking(req.body.bookingId)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.userId !== req.actor.userId) return fail(res, 403, 'You cannot pay for this booking')
    if (!['awaiting_payment', 'requested'].includes(booking.status)) return fail(res, 409, 'Booking is not awaiting payment')
    const credentials = Buffer.from(`${process.env.RAZORPAY_KEY_ID}:${process.env.RAZORPAY_KEY_SECRET}`).toString('base64')
    const response = await fetch('https://api.razorpay.com/v1/orders', { method: 'POST', headers: { authorization: `Basic ${credentials}`, 'content-type': 'application/json' }, body: JSON.stringify({ amount: Math.round(booking.fare * 100), currency: 'INR', receipt: booking.id }) })
    const order = await response.json()
    if (!response.ok) return fail(res, 502, order.error?.description || 'Payment provider could not create an order')
    const updated = await prisma.booking.update({ where: { id: booking.id }, data: { paymentMethod: 'online', paymentOrderId: order.id }, include: bookingInclude })
    await emitEvent(updated, 'payment-updated', { bookingId: updated.id, paymentStatus: updated.paymentStatus, paymentMethod: updated.paymentMethod })
    res.json({ orderId: order.id, amount: order.amount, currency: order.currency, keyId: process.env.RAZORPAY_KEY_ID })
  } catch (error) { next(error) }
})
app.post('/api/payment/verify', customerOnly, async (req, res, next) => {
  try {
    const { bookingId, razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = req.body
    const booking = await getBooking(bookingId)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.userId !== req.actor.userId) return fail(res, 403, 'You cannot pay for this booking')
    if (!process.env.RAZORPAY_KEY_SECRET || !orderId || !paymentId || !signature) return fail(res, 400, 'Payment verification details are incomplete')
    if (booking.paymentOrderId !== orderId || !['awaiting_payment', 'requested'].includes(booking.status)) return fail(res, 409, 'Payment order does not match an outstanding booking')
    const expected = crypto.createHmac('sha256', process.env.RAZORPAY_KEY_SECRET).update(`${orderId}|${paymentId}`).digest('hex')
    const actualBuffer = Buffer.from(signature)
    const expectedBuffer = Buffer.from(expected)
    if (actualBuffer.length !== expectedBuffer.length || !crypto.timingSafeEqual(actualBuffer, expectedBuffer)) return fail(res, 400, 'Payment signature is invalid')
    const updated = await updateStatus(booking, 'confirmed', { paymentStatus: 'paid', paymentMethod: 'online', paymentOrderId: null, paymentDeadline: null })
    res.json({ success: true, booking: serialize(updated) })
  } catch (error) { next(error) }
})

// Pickup/drop OTPs. Values are only stored and delivered through the configured provider.
async function deliverOtp(phone, otp, purpose) {
  if (!process.env.SMS_PROVIDER_URL || !process.env.SMS_PROVIDER_TOKEN) throw Object.assign(new Error('SMS delivery is not configured'), { statusCode: 503 })
  const response = await fetch(process.env.SMS_PROVIDER_URL, { method: 'POST', headers: { authorization: `Bearer ${process.env.SMS_PROVIDER_TOKEN}`, 'content-type': 'application/json' }, body: JSON.stringify({ to: phone, message: `Your Rydex ${purpose} OTP is ${otp}` }), signal: AbortSignal.timeout(8000) })
  if (!response.ok) throw Object.assign(new Error('SMS provider could not deliver the OTP'), { statusCode: 502 })
}
async function sendRideOtp(req, res, next, kind) {
  try {
    const booking = await getBooking(req.body.bookingId)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.vendorId !== req.actor.userId) return fail(res, 403, 'You cannot manage this ride')
    const permitted = kind === 'pickup' ? booking.status === 'confirmed' : booking.status === 'started'
    if (!permitted) return fail(res, 409, `Ride must be ${kind === 'pickup' ? 'confirmed' : 'started'} before sending this OTP`)
    const otp = String(crypto.randomInt(1000, 10000))
    const phone = booking.userMobileNumber
    if (!phone) return fail(res, 400, 'Customer mobile number is missing')
    await prisma.booking.update({ where: { id: booking.id }, data: { [kind === 'pickup' ? 'pickupOtp' : 'dropOtp']: otp } })
    await deliverOtp(phone, otp, kind)
    res.json({ success: true, message: `${kind === 'pickup' ? 'Pickup' : 'Drop'} OTP sent` })
  } catch (error) { next(error) }
}
async function verifyRideOtp(req, res, next, kind) {
  try {
    const { bookingId, otp } = req.body
    const booking = await getBooking(bookingId)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.vendorId !== req.actor.userId) return fail(res, 403, 'You cannot manage this ride')
    const field = kind === 'pickup' ? 'pickupOtp' : 'dropOtp'
    if (!otp || booking[field] !== String(otp)) return fail(res, 400, 'Invalid OTP')
    if (kind === 'pickup' && booking.status !== 'confirmed') return fail(res, 409, 'Ride is not ready to start')
    if (kind === 'drop' && booking.status !== 'started') return fail(res, 409, 'Ride is not in progress')
    const updated = await updateStatus(booking, kind === 'pickup' ? 'started' : 'completed', { [field]: null, ...(kind === 'pickup' ? { pickupAt: new Date() } : { completedAt: new Date() }) })
    res.json({ success: true, message: kind === 'pickup' ? 'Ride started' : 'Ride completed', booking: serialize(updated) })
  } catch (error) { next(error) }
}
app.post('/api/partner/bookings/send-pickup-otp', vendorOnly, (req, res, next) => sendRideOtp(req, res, next, 'pickup'))
app.post('/api/partner/bookings/verify-pickup-otp', vendorOnly, (req, res, next) => verifyRideOtp(req, res, next, 'pickup'))
app.post('/api/partner/bookings/send-drop-otp', vendorOnly, (req, res, next) => sendRideOtp(req, res, next, 'drop'))
app.post('/api/partner/bookings/verify-drop-otp', vendorOnly, (req, res, next) => verifyRideOtp(req, res, next, 'drop'))

app.use((error, _req, res, _next) => {
  console.error('[booking-service]', error)
  res.status(error.statusCode || 500).json({ success: false, message: error.statusCode ? error.message : 'Booking service request failed' })
})
app.listen(PORT, () => console.log(`booking-service running at http://localhost:${PORT}`))
