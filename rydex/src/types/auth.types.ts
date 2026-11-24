/**
 * auth.types.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Single source of truth for every auth-related type in the Rydex frontend.
 *
 * Sections:
 *   1. OTP / Verification flow
 *   2. API response shapes
 *   3. Auth modal / hook internals
 *   4. Auth context (in-memory token store)
 *   5. API-route guard helpers
 *   6. User / Redux data shape
 *   7. NextAuth module augmentation (Session, JWT, User)
 */

// ─── 1. OTP / Verification flow ───────────────────────────────────────────────

/** Discriminates the active OTP challenge being solved. */
export type OtpMode =
  | "EMAIL_VERIFICATION"
  | "RISK_OTP_VERIFICATION"
  | "ACCOUNT_RECOVERY"
  | "STEP_UP_MFA"
  | "ACCOUNT_RECOVERY_MFA";

/** Possible `nextStep` values returned by the auth API. */
export type AuthNextStep =
  | "EMAIL_VERIFICATION"
  | "RISK_OTP_VERIFICATION"
  | "ACCOUNT_RECOVERY_VERIFICATION"
  | "ACCOUNT_RECOVERY_MFA_VERIFICATION"
  | "STEP_UP_MFA_VERIFICATION"
  | "GOOGLE_OAUTH"
  | "AUTHENTICATED"
  | "RETRY_SIGNUP"
  | "ACCOUNT_RECOVERY"
  | "SIGNUP";

// ─── 2. API response shapes ───────────────────────────────────────────────────

/** Unified shape of every response from the auth-service REST endpoints. */
export type AuthResponse = {
  nextStep?: AuthNextStep;
  accessToken?: string;
  userId?: string;
  name?: string;
  email?: string;
  role?: string;
  message?: string;
  action?: string;
  attemptsRemaining?: number;
  retryAfterSecs?: number;
};

// ─── 3. Auth modal / hook internals ──────────────────────────────────────────

/** Tracks which screen the AuthModal is showing. */
export type AuthStep = "login" | "signup" | "otp";

/** Credentials captured at the start of a credential sign-up flow. */
export type SignupCredentials = {
  name: string;
  email: string;
  password: string;
};

// ─── 4. Auth context (in-memory access token) ─────────────────────────────────

/** Value exposed by <AuthProvider> via the AuthContext React context. */
export type AuthContextValue = {
  accessToken: string | null;
  setAccessToken: (token: string | null) => void;
  clearAccessToken: () => void;
};

// ─── 5. API-route guard helpers ───────────────────────────────────────────────

import type { NextRequest, NextResponse } from "next/server";

/** Resolved auth metadata passed to every protected route handler. */
export type AuthRouteContext = {
  params: Record<string, string>;
  userId: string;
  role: string;
};

/** Signature of a handler wrapped with `withAuth`. */
export type ProtectedHandler = (
  req: NextRequest,
  context: AuthRouteContext
) => Promise<NextResponse | Response> | NextResponse | Response;

// ─── 6. User / Redux data shape ───────────────────────────────────────────────

/** Shape of a logged-in user stored in the Redux `user` slice. */
export interface UserData {
  _id?: string;
  id?: string;
  name?: string;
  email?: string;
  role?: "user" | "vendor" | "admin" | "partner";
  image?: string;
  vendorOnboardingStep?: number;
  vendorStatus?: "pending" | "approved" | "rejected";
  videoKycStatus?:
  | "not_required"
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected";
  videoKycRoomId?: string;
  vendorRejectionReason?: string;
  videoKycRejectionReason?: string;
}

// ─── 7. NextAuth module augmentation ─────────────────────────────────────────
// Extends the built-in NextAuth types so `session.user.role` and
// `token.id` / `token.role` are typed throughout the app.

import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    role?: string;
  }

  interface Session {
    user: {
      id: string;
      role?: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
  }
}
