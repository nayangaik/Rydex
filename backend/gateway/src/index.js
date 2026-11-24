import 'dotenv/config'
import { createApp } from './app.js'

const app = createApp()
const port = Number(process.env.PORT || 5000)
const host = process.env.HOST || '0.0.0.0'

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error('PORT must be an integer between 1 and 65535')
}

const server = app.listen(port, host, () => {
  console.log(`[gateway] listening on http://${host}:${port}`)
})

let shuttingDown = false
function shutdown(signal) {
  if (shuttingDown) return
  shuttingDown = true
  console.log(`[gateway] received ${signal}; shutting down`)
  const forceExit = setTimeout(() => process.exit(1), 10_000)
  forceExit.unref()
  server.close((error) => {
    clearTimeout(forceExit)
    if (error) {
      console.error('[gateway] HTTP shutdown failed:', error)
      process.exitCode = 1
    }
  })
}

process.on('SIGINT', () => shutdown('SIGINT'))
process.on('SIGTERM', () => shutdown('SIGTERM'))
