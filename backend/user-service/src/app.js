import express from 'express'
import cors from 'cors'
import healthRoutes from './routes/health.routes.js'
import userRoutes from './routes/users.routes.js'
import partnerRoutes from './routes/partner.routes.js'
import adminRoutes from './routes/admin.routes.js'
import { errorHandler } from './middleware/errorHandler.js'

const app = express()
app.disable('x-powered-by')
app.use(cors({ origin: false }))
app.use(healthRoutes, userRoutes, partnerRoutes, adminRoutes)
app.use((_req, res) => res.status(404).json({ message: 'Route not found' }))
app.use(errorHandler)

export default app
