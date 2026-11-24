import express from 'express'
import cors from 'cors'
import { internal } from './middleware/internal.js'
import { errorHandler } from './middleware/errorHandler.js'
import adminRoutes from './routes/admin.routes.js'
import partnerRoutes from './routes/partner.routes.js'
import healthRoutes from './routes/health.routes.js'

export function createApp() {
  const app = express()

  app.disable('x-powered-by')
  app.use(cors({ origin: false }))
  app.use(express.json({ limit: '1mb' }))

  app.use(healthRoutes)

  app.use('/api', internal)
  app.use('/api/partner', partnerRoutes)
  app.use('/api/admin', adminRoutes)
  app.use((_req, res) => res.status(404).json({ message: 'Route not found' }))
  app.use(errorHandler)

  return app
}
