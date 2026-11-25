import { checkDisposableEmail } from '../src/lib/disposable-email.js'
import {
  generateOtp,
  hashOtp,
  otpMatches,
  requestFingerprint,
  getTrustedUntil,
  safeEnum,
} from '../src/lib/auth.helpers.js'

console.log('--- 1. Testing Disposable Email Check ---')
const test1 = checkDisposableEmail('rider@gmail.com', null)
console.log('gmail.com:', test1)
if (test1.isDisposable) throw new Error('gmail should not be disposable')

const test2 = checkDisposableEmail('rider@mailinator.com', null)
console.log('mailinator.com (no header, detected by mailchecker):', test2)
if (!test2.isDisposable || !test2.detectedBy.includes('MAILCHECKER_LOCAL_LIST')) {
  throw new Error('mailinator should be detected by mailchecker')
}

const test3 = checkDisposableEmail('custom@unknown-temp.com', 'true')
console.log('unknown-temp.com with header:', test3)
if (!test3.isDisposable || !test3.detectedBy.includes('INFRASTRUCTURE_HEADER')) {
  throw new Error('should be detected by infrastructure header')
}

console.log('\n--- 2. Testing OTP generation & constant-time hash ---')
process.env.OTP_HASH_SECRET = 'test-secret-key-1234567890'
const otp = generateOtp()
const hashed = hashOtp(otp)
console.log('Generated OTP:', otp, 'Hash length:', hashed.length)
if (!otpMatches(otp, hashed)) throw new Error('OTP match failed')
if (otpMatches('000000', hashed)) throw new Error('Invalid OTP matched')

console.log('\n--- 3. Testing trustedUntil & Device Trust ---')
const now = new Date()
const trustExpiry = getTrustedUntil(now)
console.log('Now:', now.toISOString())
console.log('Trusted until (30 days):', trustExpiry.toISOString())
const diffDays = Math.round((trustExpiry - now) / (1000 * 60 * 60 * 24))
if (diffDays !== 30) throw new Error(`Expected 30 days, got ${diffDays}`)

console.log('\n--- ALL UNIT CHECKS PASSED ---')
