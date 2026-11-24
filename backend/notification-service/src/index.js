import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import nodemailer from 'nodemailer'

const app = express()
const PORT = process.env.PORT || 5006

// ─── Nodemailer transporter ───────────────────────────────────────────────────
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || 'smtp.gmail.com',
  port: Number(process.env.SMTP_PORT || 587),
  secure: false,
  auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS },
})

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors())
app.use(express.json({ limit: '1mb' }))

// ─── Internal auth middleware ─────────────────────────────────────────────────
function internal(req, res, next) {
  if (
    !process.env.INTERNAL_SERVICE_TOKEN ||
    req.get('x-internal-service-token') !== process.env.INTERNAL_SERVICE_TOKEN
  ) {
    return res.status(401).json({ error: 'Unauthorized service request' })
  }
  next()
}

// ─── Email template renderer ──────────────────────────────────────────────────
const VALID_TYPES = [
  'otp',
  'booking_confirmed',
  'booking_cancelled',
  'ride_completed',
  'vendor_approved',
  'vendor_rejected',
  'kyc_approved',
  'kyc_rejected',
]

const baseStyle = `
  <style>
    body { margin:0; padding:0; font-family:'Segoe UI',Arial,sans-serif; background:#f4f6f9; color:#333; }
    .wrapper { max-width:600px; margin:32px auto; background:#fff; border-radius:10px; overflow:hidden; box-shadow:0 2px 12px rgba(0,0,0,.08); }
    .header { background:#1a1a2e; color:#fff; padding:28px 36px; }
    .header h1 { margin:0; font-size:24px; letter-spacing:1px; }
    .header .sub { font-size:13px; color:#aab4cf; margin-top:4px; }
    .body { padding:32px 36px; }
    .footer { background:#f0f2f8; text-align:center; padding:16px; font-size:12px; color:#888; }
    .btn { display:inline-block; margin-top:20px; padding:12px 28px; background:#4f46e5; color:#fff; border-radius:6px; text-decoration:none; font-weight:600; }
    table.details { width:100%; border-collapse:collapse; margin-top:16px; }
    table.details td { padding:10px 12px; border-bottom:1px solid #eee; font-size:14px; }
    table.details td:first-child { color:#666; width:40%; }
    table.details td:last-child { font-weight:600; }
  </style>
`

function renderTemplate(type, data) {
  switch (type) {
    // ── OTP ──────────────────────────────────────────────────────────────────
    case 'otp': {
      const { name = 'User', otp, purpose = 'verify' } = data
      const purposeLabel =
        purpose === 'verify'
          ? 'Verification'
          : purpose === 'reset'
          ? 'Password Reset'
          : 'Ride'
      const subject = `Your Rydex ${purposeLabel} OTP`
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header">
            <h1>🚀 Rydex</h1>
            <div class="sub">Ride smarter. Ride faster.</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${name}</strong>,</p>
            <p>Your one-time password for <strong>${purposeLabel}</strong> is:</p>
            <div style="text-align:center;margin:28px 0;">
              <span style="font-size:48px;font-weight:900;letter-spacing:12px;color:#4f46e5;background:#f0f0ff;padding:16px 32px;border-radius:10px;display:inline-block;">${otp}</span>
            </div>
            <p style="color:#888;font-size:13px;text-align:center;">This OTP is valid for <strong>10 minutes</strong>. Do not share it with anyone.</p>
            <p style="margin-top:24px;font-size:14px;">If you did not request this OTP, please ignore this email or contact support immediately.</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    // ── Booking Confirmed ─────────────────────────────────────────────────────
    case 'booking_confirmed': {
      const { userName = 'User', driverName, vehicleType, pickupAddress, dropAddress, fare } = data
      const subject = 'Booking Confirmed — Rydex'
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header" style="background:#065f46;">
            <h1>✅ Rydex — Booking Confirmed!</h1>
            <div class="sub">Your ride is on the way</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${userName}</strong>, your booking has been confirmed!</p>
            <table class="details">
              <tr><td>Driver</td><td>${driverName || '—'}</td></tr>
              <tr><td>Vehicle Type</td><td>${vehicleType || '—'}</td></tr>
              <tr><td>Pickup</td><td>${pickupAddress || '—'}</td></tr>
              <tr><td>Drop</td><td>${dropAddress || '—'}</td></tr>
              <tr><td>Estimated Fare</td><td style="color:#065f46;">₹${fare || '—'}</td></tr>
            </table>
            <p style="margin-top:24px;font-size:13px;color:#888;">Track your ride in the Rydex app. Safe travels! 🚗</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    // ── Booking Cancelled ─────────────────────────────────────────────────────
    case 'booking_cancelled': {
      const { userName = 'User', reason } = data
      const subject = 'Booking Cancelled — Rydex'
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header" style="background:#7f1d1d;">
            <h1>❌ Rydex — Booking Cancelled</h1>
            <div class="sub">We're sorry for the inconvenience</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${userName}</strong>,</p>
            <p>Your booking has been <strong>cancelled</strong>${reason ? ` for the following reason:` : '.'}</p>
            ${reason ? `<div style="background:#fff5f5;border-left:4px solid #ef4444;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;">${reason}</div>` : ''}
            <p style="font-size:14px;margin-top:16px;">You can book a new ride anytime from the Rydex app. We apologise for the inconvenience.</p>
            <a class="btn" href="#" style="background:#4f46e5;">Book Again</a>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    // ── Ride Completed ────────────────────────────────────────────────────────
    case 'ride_completed': {
      const { userName = 'User', fare, driverName, pickupAddress, dropAddress } = data
      const subject = `Ride Completed — Rydex | ₹${fare}`
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header" style="background:#1e3a5f;">
            <h1>🏁 Rydex — Ride Receipt</h1>
            <div class="sub">Thanks for riding with us!</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${userName}</strong>, your ride is complete!</p>
            <div style="text-align:center;margin:24px 0;">
              <div style="font-size:13px;color:#888;text-transform:uppercase;letter-spacing:1px;">Total Fare</div>
              <div style="font-size:48px;font-weight:900;color:#4f46e5;margin-top:4px;">₹${fare || '—'}</div>
            </div>
            <table class="details">
              <tr><td>Driver</td><td>${driverName || '—'}</td></tr>
              <tr><td>Pickup</td><td>${pickupAddress || '—'}</td></tr>
              <tr><td>Drop</td><td>${dropAddress || '—'}</td></tr>
            </table>
            <p style="margin-top:24px;font-size:13px;color:#888;">We hope you had a great experience. Rate your ride in the Rydex app! ⭐</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    // ── Vendor Approved ───────────────────────────────────────────────────────
    case 'vendor_approved': {
      const { vendorName = 'Partner' } = data
      const subject = 'Your Rydex Partner Application is Approved 🎉'
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header" style="background:#065f46;">
            <h1>🎉 Welcome to Rydex Partners!</h1>
            <div class="sub">Your application has been approved</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${vendorName}</strong>,</p>
            <p>Congratulations! Your Rydex partner application has been <strong style="color:#065f46;">approved</strong>.</p>
            <p style="margin-top:16px;">Here's what to do next:</p>
            <ol style="font-size:14px;line-height:2;">
              <li>Complete your <strong>Video KYC</strong> verification in the app</li>
              <li>Add your <strong>vehicle details</strong> to start accepting rides</li>
              <li>Go <strong>online</strong> and start earning!</li>
            </ol>
            <a class="btn" href="#">Open Rydex Partner App</a>
            <p style="margin-top:24px;font-size:13px;color:#888;">If you have any questions, contact our partner support team. Welcome aboard! 🚀</p>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    // ── Vendor Rejected ───────────────────────────────────────────────────────
    case 'vendor_rejected': {
      const { vendorName = 'Applicant', reason } = data
      const subject = 'Your Rydex Partner Application — Update Required'
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header" style="background:#78350f;">
            <h1>📋 Rydex Partner Application Update</h1>
            <div class="sub">Action required on your application</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${vendorName}</strong>,</p>
            <p>After reviewing your Rydex partner application, we were unable to approve it at this time.</p>
            ${reason ? `<div style="background:#fffbeb;border-left:4px solid #f59e0b;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;"><strong>Reason:</strong> ${reason}</div>` : ''}
            <p style="font-size:14px;margin-top:16px;">Please review the information above, make the necessary corrections, and reapply through the Rydex app. Our team will be happy to assist you.</p>
            <a class="btn" href="#" style="background:#78350f;">Reapply Now</a>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    // ── KYC Approved ──────────────────────────────────────────────────────────
    case 'kyc_approved': {
      const { vendorName = 'Partner' } = data
      const subject = 'Video KYC Approved — Rydex Partner'
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header" style="background:#065f46;">
            <h1>✅ KYC Verified!</h1>
            <div class="sub">Your identity has been confirmed</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${vendorName}</strong>,</p>
            <p>Great news! Your <strong>Video KYC</strong> has been <strong style="color:#065f46;">approved</strong>.</p>
            <p style="margin-top:16px;">You are now fully verified and can start accepting rides on the Rydex platform. Go online and start earning!</p>
            <a class="btn">Start Riding 🚗</a>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    // ── KYC Rejected ──────────────────────────────────────────────────────────
    case 'kyc_rejected': {
      const { vendorName = 'Partner', reason } = data
      const subject = 'Video KYC Rejected — Action Required'
      const html = `<!DOCTYPE html><html><head>${baseStyle}</head><body>
        <div class="wrapper">
          <div class="header" style="background:#7f1d1d;">
            <h1>⚠️ KYC Verification Failed</h1>
            <div class="sub">Please resubmit your verification</div>
          </div>
          <div class="body">
            <p style="font-size:16px;">Hi <strong>${vendorName}</strong>,</p>
            <p>Unfortunately, your <strong>Video KYC</strong> verification could not be approved.</p>
            ${reason ? `<div style="background:#fff5f5;border-left:4px solid #ef4444;padding:14px 18px;border-radius:4px;margin:16px 0;font-size:14px;"><strong>Reason:</strong> ${reason}</div>` : ''}
            <p style="font-size:14px;margin-top:16px;">Please re-record your KYC video through the Rydex Partner app. Ensure good lighting and that your face is clearly visible throughout the recording.</p>
            <a class="btn" style="background:#7f1d1d;">Resubmit KYC</a>
          </div>
          <div class="footer">© ${new Date().getFullYear()} Rydex. All rights reserved.</div>
        </div>
      </body></html>`
      return { subject, html }
    }

    default:
      throw new Error(`Unknown template type: ${type}`)
  }
}

// ─── Helper: send SMS logic ───────────────────────────────────────────────────
async function sendSMS(to, message) {
  if (!process.env.SMS_PROVIDER_URL) {
    console.warn('[notification-service] SMS_PROVIDER_URL not configured — skipping SMS')
    return { success: false, error: 'SMS not configured', skipped: true, _status: 503 }
  }
  try {
    const res = await fetch(process.env.SMS_PROVIDER_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.SMS_PROVIDER_TOKEN || ''}`,
      },
      body: JSON.stringify({ to, message }),
    })
    if (!res.ok) {
      const text = await res.text()
      return { success: false, error: `SMS provider error: ${res.status} ${text}`, _status: 502 }
    }
    return { success: true }
  } catch (err) {
    return { success: false, error: err.message, _status: 502 }
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'notification-service' })
})

// POST /api/notify/email
app.post('/api/notify/email', internal, async (req, res, next) => {
  try {
    const { to, type, data } = req.body

    // Validate
    if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      return res.status(400).json({ error: 'Invalid or missing "to" email address' })
    }
    if (!type || !VALID_TYPES.includes(type)) {
      return res.status(400).json({ error: `Invalid or missing "type". Must be one of: ${VALID_TYPES.join(', ')}` })
    }
    if (!data || typeof data !== 'object' || Array.isArray(data)) {
      return res.status(400).json({ error: '"data" must be a non-null object' })
    }

    const { subject, html } = renderTemplate(type, data)

    try {
      const info = await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        html,
      })
      return res.json({ success: true, messageId: info.messageId })
    } catch (smtpErr) {
      console.error('[notification-service] SMTP error:', smtpErr.message)
      return res.status(502).json({ success: false, error: smtpErr.message })
    }
  } catch (err) {
    next(err)
  }
})

// POST /api/notify/sms
app.post('/api/notify/sms', internal, async (req, res, next) => {
  try {
    const { to, message } = req.body

    if (!to || !/^\+?\d{10,}$/.test(String(to).replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Invalid or missing "to" phone number (10+ digits required)' })
    }
    if (!message || typeof message !== 'string') {
      return res.status(400).json({ error: '"message" must be a non-empty string' })
    }
    if (message.length > 160) {
      return res.status(400).json({ error: '"message" must not exceed 160 characters' })
    }

    const result = await sendSMS(to, message)
    const status = result._status || 200
    delete result._status
    return res.status(status).json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/notify/otp-sms
app.post('/api/notify/otp-sms', internal, async (req, res, next) => {
  try {
    const { to, otp, purpose } = req.body
    const validPurposes = ['pickup', 'drop', 'verify', 'reset']

    if (!to || !/^\+?\d{10,}$/.test(String(to).replace(/\s/g, ''))) {
      return res.status(400).json({ error: 'Invalid or missing "to" phone number (10+ digits required)' })
    }
    if (!otp) {
      return res.status(400).json({ error: '"otp" is required' })
    }
    if (!purpose || !validPurposes.includes(purpose)) {
      return res.status(400).json({ error: `"purpose" must be one of: ${validPurposes.join(', ')}` })
    }

    const message = `Your Rydex ${purpose} OTP is ${otp}. Valid for 10 minutes.`
    const result = await sendSMS(to, message)
    const status = result._status || 200
    delete result._status
    return res.status(status).json(result)
  } catch (err) {
    next(err)
  }
})

// POST /api/notify/bulk-email
app.post('/api/notify/bulk-email', internal, async (req, res, next) => {
  try {
    const { recipients } = req.body

    if (!Array.isArray(recipients) || recipients.length === 0) {
      return res.status(400).json({ error: '"recipients" must be a non-empty array' })
    }
    if (recipients.length > 50) {
      return res.status(400).json({ error: '"recipients" must not exceed 50 entries' })
    }

    const tasks = recipients.map(async ({ to, type, data }, idx) => {
      if (!to || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
        return { index: idx, success: false, error: 'Invalid email address' }
      }
      if (!type || !VALID_TYPES.includes(type)) {
        return { index: idx, success: false, error: `Unknown template type: ${type}` }
      }
      if (!data || typeof data !== 'object') {
        return { index: idx, success: false, error: '"data" must be an object' }
      }
      try {
        const { subject, html } = renderTemplate(type, data)
        const info = await transporter.sendMail({
          from: process.env.SMTP_FROM || process.env.SMTP_USER,
          to,
          subject,
          html,
        })
        return { index: idx, to, success: true, messageId: info.messageId }
      } catch (err) {
        return { index: idx, to, success: false, error: err.message }
      }
    })

    const settled = await Promise.allSettled(tasks)
    const results = settled.map(s => (s.status === 'fulfilled' ? s.value : { success: false, error: s.reason?.message }))
    const sent = results.filter(r => r.success).length
    const failed = results.length - sent

    return res.json({ sent, failed, results })
  } catch (err) {
    next(err)
  }
})

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((error, _req, res, _next) => {
  console.error('[notification-service]', error)
  res.status(500).json({ error: 'Notification service request failed' })
})

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`[notification-service] Running on port ${PORT}`)
})
