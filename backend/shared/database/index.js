import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

dotenv.config({ path: fileURLToPath(new URL('../../.env', import.meta.url)), override: true })

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required by the shared database package')
}

const globalForPrisma = globalThis

const prisma = globalForPrisma.rydexPrisma ?? new PrismaClient()

if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.rydexPrisma = prisma
}

export default prisma
export { prisma }
