import prisma from './db.js'
import crypto from 'node:crypto'

export const bookingInclude = {
  user: { select: { id: true, name: true, email: true, image: true } },
  vendor: { select: { id: true, name: true, email: true, image: true } },
  vehicle: true,
}

export function serialize(booking) {
  if (!booking) return null
  const { vendor, ...rest } = booking
  return { ...rest, _id: booking.id, driver: vendor ?? null }
}

export function fail(res, status, message) {
  return res.status(status).json({ success: false, message })
}

export async function emitEvent(booking, event, payload) {
  const base = process.env.SOCKET_SERVER_URL
  if (!base) return
  try {
    const response = await fetch(new URL('/booking-event', base), {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-internal-service-token': process.env.INTERNAL_SERVICE_TOKEN || '',
      },
      body: JSON.stringify({ bookingId: booking.id, event, recipients: [booking.userId, booking.vendorId], payload: { ...payload, bookingId: booking.id } }),
      signal: AbortSignal.timeout(2500),
    })
    if (!response.ok) console.warn(`[booking-service] socket event rejected (${response.status}):`, await response.text())
  } catch (error) {
    console.warn('[booking-service] socket event delivery failed:', error.message)
  }
}

export async function emitUpdated(booking) {
  const data = { bookingId: booking.id, status: booking.status, paymentStatus: booking.paymentStatus }
  await emitEvent(booking, 'booking-updated', data)
  if (booking.status === 'started') await emitEvent(booking, 'ride-started', data)
  if (booking.status === 'completed') await emitEvent(booking, 'ride-completed', data)
  if (booking.paymentStatus !== 'pending') await emitEvent(booking, 'payment-updated', { ...data, paymentMethod: booking.paymentMethod })
}

export function validPoint(value) {
  return (
    value &&
    value.type === 'Point' &&
    Array.isArray(value.coordinates) &&
    value.coordinates.length === 2 &&
    value.coordinates.every(Number.isFinite)
  )
}

export async function getBooking(id) {
  return prisma.booking.findUnique({ where: { id }, include: bookingInclude })
}

export function actorCanRead(booking, actor) {
  return actor.role === 'admin' || booking.userId === actor.userId || booking.vendorId === actor.userId
}

export async function updateStatus(booking, status, extra = {}) {
  const updated = await prisma.booking.update({
    where: { id: booking.id },
    data: { status, ...extra },
    include: bookingInclude,
  })
  await emitUpdated(updated)
  return updated
}

export async function deliverOtp(phone, otp, purpose) {
  if (!process.env.SMS_PROVIDER_URL || !process.env.SMS_PROVIDER_TOKEN)
    throw Object.assign(new Error('SMS delivery is not configured'), { statusCode: 503 })
  const response = await fetch(process.env.SMS_PROVIDER_URL, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${process.env.SMS_PROVIDER_TOKEN}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({ to: phone, message: `Your Rydex ${purpose} OTP is ${otp}` }),
    signal: AbortSignal.timeout(8000),
  })
  if (!response.ok)
    throw Object.assign(new Error('SMS provider could not deliver the OTP'), { statusCode: 502 })
}

export async function sendRideOtp(req, res, next, kind) {
  try {
    const booking = await getBooking(req.body.bookingId)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.vendorId !== req.actor.userId) return fail(res, 403, 'You cannot manage this ride')
    const permitted = kind === 'pickup' ? booking.status === 'confirmed' : booking.status === 'started'
    if (!permitted)
      return fail(res, 409, `Ride must be ${kind === 'pickup' ? 'confirmed' : 'started'} before sending this OTP`)
    const otp = String(crypto.randomInt(1000, 10000))
    const phone = booking.userMobileNumber
    if (!phone) return fail(res, 400, 'Customer mobile number is missing')
    await prisma.booking.update({
      where: { id: booking.id },
      data: { [kind === 'pickup' ? 'pickupOtp' : 'dropOtp']: otp },
    })
    await deliverOtp(phone, otp, kind)
    res.json({ success: true, message: `${kind === 'pickup' ? 'Pickup' : 'Drop'} OTP sent` })
  } catch (error) {
    next(error)
  }
}

export async function verifyRideOtp(req, res, next, kind) {
  try {
    const { bookingId, otp } = req.body
    const booking = await getBooking(bookingId)
    if (!booking) return fail(res, 404, 'Booking not found')
    if (booking.vendorId !== req.actor.userId) return fail(res, 403, 'You cannot manage this ride')
    const field = kind === 'pickup' ? 'pickupOtp' : 'dropOtp'
    if (!otp || booking[field] !== String(otp)) return fail(res, 400, 'Invalid OTP')
    if (kind === 'pickup' && booking.status !== 'confirmed') return fail(res, 409, 'Ride is not ready to start')
    if (kind === 'drop' && booking.status !== 'started') return fail(res, 409, 'Ride is not in progress')
    const updated = await updateStatus(booking, kind === 'pickup' ? 'started' : 'completed', {
      [field]: null,
      ...(kind === 'pickup' ? { pickupAt: new Date() } : { completedAt: new Date() }),
    })
    res.json({
      success: true,
      message: kind === 'pickup' ? 'Ride started' : 'Ride completed',
      booking: serialize(updated),
    })
  } catch (error) {
    next(error)
  }
}
