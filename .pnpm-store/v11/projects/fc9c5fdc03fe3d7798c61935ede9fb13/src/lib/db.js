import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'
import { PrismaClient } from '@prisma/client'

dotenv.config({ path: fileURLToPath(new URL('../../../.env', import.meta.url)), override: true })

if (!process.env.AUTH_DATABASE_URL) {
  throw new Error('AUTH_DATABASE_URL is required by auth-service')
}

const prisma = new PrismaClient({ datasources: { db: { url: process.env.AUTH_DATABASE_URL } } })

export default prisma
