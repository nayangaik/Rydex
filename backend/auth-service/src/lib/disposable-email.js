/**
 * disposable-email.js
 *
 * Two-layer disposable email detection:
 *
 *   Layer 1 (Infrastructure) — `x-email-disposable: true` header
 *     Injected by the WAF / API Gateway after checking a 3rd-party
 *     email reputation API (e.g. Abstract API, ZeroBounce). Fast,
 *     but only fires when the upstream service is configured.
 *
 *   Layer 2 (Local, offline) — mailchecker open-source blocklist
 *     ~55,000+ known disposable / temporary email domains checked
 *     in-process with O(1) Set lookup. No network round-trip, always
 *     runs regardless of infrastructure header.
 *
 * Result: `isDisposableEmail` is `true` if either layer detects the
 * address as disposable. The two layers are ORed together so the
 * local list catches domains that the upstream service may have missed.
 *
 * mailchecker: https://github.com/FGRibreau/mailchecker
 *   License: MIT
 *   Domain list: community-maintained, ~55k entries
 */

import { createRequire } from 'node:module'

// mailchecker ships as CJS; use createRequire to load it in an ESM project.
const require   = createRequire(import.meta.url)
const MailChecker = require('mailchecker/platform/node')

/**
 * checkDisposableEmail(email, infrastructureHeader)
 *
 * @param {string}       email               — normalized email address
 * @param {string|null}  infrastructureHeader — value of `x-email-disposable` header
 *                                             from the trusted upstream stack
 * @returns {{ isDisposable: boolean, detectedBy: string[] }}
 *
 *   `isDisposable`  — true if either layer flagged the email
 *   `detectedBy`    — which layers fired (for audit / debugging)
 */
export function checkDisposableEmail(email, infrastructureHeader) {
  const detectedBy = []

  // Layer 1: trusted infrastructure header (WAF / API Gateway signal).
  // The header is injected by the upstream stack after checking an
  // email reputation service. We only trust it when it is explicitly 'true'.
  const infraSignal = infrastructureHeader === 'true'
  if (infraSignal) detectedBy.push('INFRASTRUCTURE_HEADER')

  // Layer 2: local open-source blocklist via mailchecker.
  // MailChecker.isValid() returns FALSE when the domain is disposable,
  // so we negate it: !isValid → disposable.
  // It also returns false for syntactically invalid emails; that's fine
  // because we have already validated email format in step 1 of register().
  let localSignal = false
  try {
    localSignal = !MailChecker.isValid(email)
    if (localSignal) detectedBy.push('MAILCHECKER_LOCAL_LIST')
  } catch {
    // If the library throws for any reason (corrupt install, etc.)
    // we degrade gracefully — we still have the infrastructure signal.
    localSignal = false
  }

  return {
    isDisposable: infraSignal || localSignal,
    detectedBy,
  }
}
