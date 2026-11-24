import 'dotenv/config'
import './routes/index.js'
import app from './app.js'
import prisma from './lib/db.js'

const port = Number(process.env.PORT || 5002)
const host = process.env.HOST || '0.0.0.0'

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

const server = app.listen(port, host, () => {
  console.log(`[user-service] listening on http://${host}:${port}`)
})

let shuttingDown = false
async function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[user-service] received ${signal}; shutting down`)
  const forceExit = setTimeout(() => process.exit(1), 10_000)
  forceExit.unref()
  server.close(async (error) => {
    if (error) console.error('[user-service] HTTP shutdown failed:', error)
    try {
      await prisma.$disconnect()
    } catch (disconnectError) {
      console.error('[user-service] Prisma shutdown failed:', disconnectError)
      process.exitCode = 1
    }
    clearTimeout(forceExit)
    if (error) process.exitCode = 1
  })
}

process.on('SIGINT', () => void shutdown('SIGINT'))
process.on('SIGTERM', () => void shutdown('SIGTERM'))
