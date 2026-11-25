import nodemailer from 'nodemailer'
import dotenv from 'dotenv'
import { fileURLToPath } from 'node:url'

// Resolve this service's credentials relative to this file, not process.cwd().
// The auth service is also launched from the backend root in some workflows.
dotenv.config({
  path: fileURLToPath(new URL('../../.env', import.meta.url)),
  override: false,
})

const isLocalJsonTransport =
  process.env.NODE_ENV !== 'production' && process.env.EMAIL_TRANSPORT === 'json'
const emailUser = process.env.EMAIL
const emailPassword = process.env.PASS || process.env.EMAIL_PASS

const transporter = isLocalJsonTransport
  ? nodemailer.createTransport({ jsonTransport: true })
  : nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: emailUser,
        pass: emailPassword,
      },
    })

/**
 * sendMail — send a transactional email via Gmail.
 * @param {string} to      - Recipient email address
 * @param {string} subject - Email subject
 * @param {string} html    - HTML body
 */
export async function sendMail(to, subject, html) {
  if (!to || !subject || !html) throw new Error('EMAIL_RECIPIENT_SUBJECT_AND_BODY_REQUIRED')
  if (!isLocalJsonTransport && (!emailUser || !emailPassword)) {
    throw new Error('EMAIL and EMAIL_PASS (or PASS) must be configured for Gmail delivery')
  }

  try {
    const info = await transporter.sendMail({
      from: emailUser || 'no-reply@rydex.local',
      to,
      subject,
      html,
    })

    // A resolved SMTP operation can still report rejected recipients. Do not
    // report the OTP as sent unless the configured mail transport accepted it.
    if (!isLocalJsonTransport && (!info.accepted?.length || info.rejected?.length)) {
      console.error('[auth-service] email recipient was not accepted by SMTP', {
        subject,
        acceptedCount: info.accepted?.length ?? 0,
        rejectedCount: info.rejected?.length ?? 0,
        response: info.response,
      })
      throw new Error('SMTP did not accept the email recipient')
    }

    console.info('[auth-service] email accepted by transport', {
      subject,
      messageId: info.messageId,
      acceptedCount: info.accepted?.length ?? (isLocalJsonTransport ? 1 : 0),
      rejectedCount: info.rejected?.length ?? 0,
    })
    return info
  } catch (error) {
    console.error('Error sending email:', error)
    throw error
  }
}
