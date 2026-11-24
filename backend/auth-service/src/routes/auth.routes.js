import { Router } from 'express'

import { register }  from '../controllers/SignUp.controller.js'
import { verifyOtp }  from '../controllers/verifyotp.ts'
import { resendOtp }  from '../controllers/resendotp.ts'
import { refreshSession } from '../controllers/refresh.controller.js'
import { signin } from '../controllers/SignIn.controller.js'

const router = Router()

/* ── Credentials Sign-Up workflow ──────────────────────────────── */
router.post('/register',    register)    // POST /api/auth/register
router.post('/signin',    signin)    // POST /api/auth/signin
router.post('/verify-otp',  verifyOtp)   // POST /api/auth/verify-otp
router.post('/resend-otp',  resendOtp)   // POST /api/auth/resend-otp
router.post('/refresh',     refreshSession) // POST /api/auth/refresh

export default router
