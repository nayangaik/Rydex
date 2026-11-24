import express from 'express'
import cors from 'cors'
import rateLimit from 'express-rate-limit'
import { setupProxy } from './proxy.js'
import healthRoutes from './routes/health.routes.js'

export function createApp() {
  const app = express()
  const allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://localhost:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean)

  app.disable('x-powered-by')
  app.use(cors({ origin: allowedOrigins, credentials: true }))

  // Keep the proxy before body parsers so upstream request bodies remain streamable.
  app.use('/api/auth', rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 30,
    standardHeaders: true,
    legacyHeaders: false,
    message: { message: 'Too many requests. Please try again in 15 minutes.' },
  }))

  app.use('/api', healthRoutes)
  setupProxy(app)
  app.use((_req, res) => res.status(404).json({ message: 'Route not found on gateway' }))

  return app
}
