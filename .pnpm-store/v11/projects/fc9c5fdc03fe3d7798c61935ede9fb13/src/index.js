import 'dotenv/config'
import express    from 'express'
import cors       from 'cors'
import authRoutes from './routes/auth.routes.js'

const app  = express()
const PORT = process.env.PORT || 5001

/* ── CORS ─────────────────────────────────────────────────────────
   Only allow the gateway to call this service.
   The browser never hits auth-service directly.
   ─────────────────────────────────────────────────────────────── */
app.use(cors({
  // Allow the gateway and the frontend origin (since the proxy forwards the Origin header)
  origin: (origin, callback) => {
    const allowed = ['http://localhost:5000', 'http://localhost:3000']
    if (!origin || allowed.includes(origin)) {
      callback(null, true)
    } else {
      callback(new Error(`CORS blocked: ${origin}`))
    }
  },
  credentials: true,
}))

app.use(express.json({ limit: '1mb' }))
// Keep auth challenge identifiers in HttpOnly cookies; controllers consume them
// through req.cookies without requiring the client to echo challenge IDs.
app.use((req, _res, next) => {
  const cookieHeader = req.headers.cookie || ''
  req.cookies = Object.fromEntries(cookieHeader.split(';').flatMap((part) => {
    const separator = part.indexOf('=')
    if (separator < 0) return []
    const name = part.slice(0, separator).trim()
    const value = part.slice(separator + 1).trim()
    try { return [[name, decodeURIComponent(value)]] } catch { return [[name, value]] }
  }))
  next()
})

/* ── Health ───────────────────────────────────────────────────── */
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'auth-service', ts: new Date().toISOString() })
})

/* ── Auth routes ──────────────────────────────────────────────── */
app.use('/api/auth', authRoutes)

/* ── 404 fallback ─────────────────────────────────────────────── */
app.use((_req, res) => {
  res.status(404).json({ message: 'Not found' })
})

/* ── Start ───────────────────────────────────────────────────── */
app.listen(PORT, () => {
  console.log(`🔐 auth-service running  →  http://localhost:${PORT}`)
})
