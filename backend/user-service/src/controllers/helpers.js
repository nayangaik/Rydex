import prisma from '../lib/db.js'

export const ensureAccount = (userId) => prisma.userAccount.upsert({ where: { userId }, create: { userId }, update: {} })
export const audit = (userId, actorId, action, details) => prisma.accountAuditEvent.create({ data: { userId, actorId, action, details } })
export const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export function demoEarnings(days, base, amplitude) {
  return Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setDate(d.getDate() - (days - 1 - i))
    const label = days <= 7 ? DAY_LABELS[d.getDay()] : d.toISOString().slice(5, 10)
    return { date: label, earnings: Math.round(base + Math.sin(i * 1.9 + 0.5) * amplitude), trips: Math.round(3 + Math.abs(Math.sin(i)) * 4) }
  })
}
