-- CreateEnum
CREATE TYPE "user_role" AS ENUM ('RIDER', 'VENDOR', 'ADMIN', 'PARTNER', 'SUPPORT');

-- CreateEnum
CREATE TYPE "VendorStatus" AS ENUM ('pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "VideoKycStatus" AS ENUM ('not_required', 'in_progress', 'pending', 'approved', 'rejected');

-- CreateEnum
CREATE TYPE "VehicleType" AS ENUM ('bike', 'car', 'loading', 'truck', 'auto');

-- CreateEnum
CREATE TYPE "ApprovalStatus" AS ENUM ('approved', 'pending', 'rejected');

-- CreateEnum
CREATE TYPE "BankStatus" AS ENUM ('not_added', 'added', 'verified');

-- CreateEnum
CREATE TYPE "BookingStatus" AS ENUM ('requested', 'awaiting_payment', 'confirmed', 'started', 'rejected', 'expired', 'pending', 'active', 'completed', 'cancelled');

-- CreateEnum
CREATE TYPE "PaymentStatus" AS ENUM ('pending', 'paid', 'cash', 'failed');

-- CreateEnum
CREATE TYPE "AccountStatus" AS ENUM ('active', 'suspended', 'deactivation_requested', 'deletion_requested', 'deleted');

-- CreateEnum
CREATE TYPE "account_status" AS ENUM ('PENDING', 'ACTIVE', 'SUSPENDED', 'BLOCKED', 'DELETED');

-- CreateEnum
CREATE TYPE "AccountRequestType" AS ENUM ('deactivation', 'reactivation', 'deletion');

-- CreateEnum
CREATE TYPE "AccountRequestStatus" AS ENUM ('pending', 'approved', 'rejected', 'cancelled');

-- CreateEnum
CREATE TYPE "auth_flow_intent" AS ENUM ('CREDENTIALS_SIGNUP', 'CREDENTIALS_SIGNIN', 'GOOGLE_OAUTH_SIGNUP', 'GOOGLE_OAUTH_SIGNIN', 'PASSWORD_RECOVERY', 'PASSWORD_CHANGE', 'ACCOUNT_ACTIVATION', 'ACCOUNT_RECOVERY', 'ACCOUNT_DELETION', 'OTP_VERIFICATION', 'OTP_RESEND', 'TOKEN_REFRESH', 'SESSION_LOGOUT', 'SESSION_LOGOUT_ALL', 'SESSION_REVOKE');

-- CreateEnum
CREATE TYPE "risk_decision" AS ENUM ('ALLOW', 'CHALLENGE_OTP', 'REJECT');

-- CreateEnum
CREATE TYPE "otp_purpose" AS ENUM ('EMAIL_VERIF', 'RISK_CHALLENGE', 'STEP_UP_MFA', 'PASSWORD_RECOVERY', 'ACCOUNT_RECOVERY', 'ACCOUNT_DELETION');

-- CreateEnum
CREATE TYPE "otp_originating_flow" AS ENUM ('NEW_SIGNUP', 'EXISTING_SIGNIN', 'ACCOUNT_ACTIVATION', 'ACCOUNT_RECOVERY', 'PASSWORD_RECOVERY', 'ACCOUNT_DELETION');

-- CreateEnum
CREATE TYPE "oauth_provider" AS ENUM ('GOOGLE');

-- CreateEnum
CREATE TYPE "oauth_link_method" AS ENUM ('INITIAL_SIGNUP', 'AUTO_VERIFIED_LINK', 'OTP_VERIFIED_LINK');

-- CreateEnum
CREATE TYPE "session_revoke_reason" AS ENUM ('CONCURRENCY_LIMIT_EXCEEDED', 'USER_LOGOUT', 'TOKEN_ROTATION', 'REUSE_DETECTED', 'ADMIN_OR_SECURITY_LOCK');

-- CreateEnum
CREATE TYPE "oauth_transaction_status" AS ENUM ('INITIATED', 'CALLBACK_PROCESSING', 'SUCCEEDED', 'FAILED', 'DENIED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "oauth_resolution_case" AS ENUM ('CASE_A', 'CASE_B', 'CASE_C');

-- CreateEnum
CREATE TYPE "otp_challenge_status" AS ENUM ('ACTIVE', 'USED', 'EXPIRED', 'LOCKED', 'SUPERSEDED', 'REVOKED');

-- CreateEnum
CREATE TYPE "waf_security_action" AS ENUM ('ALLOW', 'BLOCK', 'CAPTCHA', 'CHALLENGE', 'COUNT');

-- CreateEnum
CREATE TYPE "waf_challenge_type" AS ENUM ('CAPTCHA', 'JS_CHALLENGE');

-- CreateEnum
CREATE TYPE "waf_challenge_status" AS ENUM ('NOT_APPLICABLE', 'PENDING', 'PASSED', 'FAILED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "nginx_limit_status" AS ENUM ('ALLOWED', 'RATE_LIMITED', 'CONNECTION_LIMITED', 'REJECTED');

-- CreateEnum
CREATE TYPE "gateway_decision_status" AS ENUM ('ALLOWED', 'RATE_LIMITED', 'REJECTED');

-- CreateEnum
CREATE TYPE "gateway_policy_status" AS ENUM ('ALLOWED', 'DENIED', 'ERROR');

-- CreateEnum
CREATE TYPE "security_event_type" AS ENUM ('SIGNUP_RISK_REJECTED', 'SIGNUP_RISK_OTP_FAILED', 'RESTRICTED_ACCOUNT_ACCESS_ATTEMPT', 'CREDENTIALS_INVALID_PASSWORD', 'OTP_MAX_ATTEMPTS_LOCKOUT', 'OAUTH_STATE_MISMATCH_OR_REPLAY', 'OAUTH_TOKEN_EXCHANGE_FAILED', 'OAUTH_ID_TOKEN_VALIDATION_FAILED', 'OAUTH_UNVERIFIED_EMAIL_REJECTED', 'STEP_UP_MFA_LOCKOUT', 'NEW_DEVICE_SIGNIN_DETECTED', 'SESSION_REVOKED_CONCURRENCY', 'REFRESH_TOKEN_REUSE_DETECTED');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "name" VARCHAR(120) NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "password_hash" VARCHAR(255),
    "image" TEXT,
    "role" "user_role" NOT NULL DEFAULT 'RIDER',
    "is_verified" BOOLEAN NOT NULL DEFAULT false,
    "email_verified_at" TIMESTAMPTZ(6),
    "phone_number" VARCHAR(32),
    "phone_verified_at" TIMESTAMPTZ(6),
    "account_status" "account_status" NOT NULL DEFAULT 'PENDING',
    "password_changed_at" TIMESTAMPTZ(6),
    "suspended_at" TIMESTAMPTZ(6),
    "suspension_reason" TEXT,
    "blocked_at" TIMESTAMPTZ(6),
    "blocked_reason" TEXT,
    "deleted_at" TIMESTAMPTZ(6),
    "mfa_failed_attempts" INTEGER NOT NULL DEFAULT 0,
    "mfa_last_failed_at" TIMESTAMPTZ(6),
    "mfa_locked_until" TIMESTAMPTZ(6),
    "last_login_at" TIMESTAMPTZ(6),
    "vendorOnboardingStep" INTEGER NOT NULL DEFAULT 0,
    "vendorStatus" "VendorStatus" NOT NULL DEFAULT 'pending',
    "vendorRejectionReason" TEXT DEFAULT '',
    "vendorProfileCompleted" BOOLEAN NOT NULL DEFAULT false,
    "vendorApprovedAt" TIMESTAMP(3),
    "isVendorBlocked" BOOLEAN NOT NULL DEFAULT false,
    "videoKycStatus" "VideoKycStatus" NOT NULL DEFAULT 'not_required',
    "videoKycRoomId" TEXT,
    "videoKycRejectionReason" TEXT,
    "isOnline" BOOLEAN NOT NULL DEFAULT false,
    "socketId" TEXT,
    "currentVehicleType" "VehicleType",
    "locationLng" DOUBLE PRECISION,
    "locationLat" DOUBLE PRECISION,
    "lastLocationUpdate" TIMESTAMP(3),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "vehicleId" UUID,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Vehicle" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "type" "VehicleType" NOT NULL,
    "vehicleModel" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "imageUrl" TEXT,
    "baseFare" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "pricePerKM" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "waitingCharge" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Vehicle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerBank" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "accountHolder" TEXT NOT NULL,
    "accountNumber" TEXT NOT NULL,
    "ifsc" TEXT NOT NULL,
    "upi" TEXT,
    "mobileNumber" TEXT NOT NULL,
    "status" "BankStatus" NOT NULL DEFAULT 'not_added',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerBank_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PartnerDocs" (
    "id" UUID NOT NULL,
    "ownerId" UUID NOT NULL,
    "aadharUrl" TEXT NOT NULL,
    "rcUrl" TEXT NOT NULL,
    "licenseUrl" TEXT NOT NULL,
    "status" "ApprovalStatus" NOT NULL DEFAULT 'pending',
    "rejectionReason" TEXT DEFAULT '',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PartnerDocs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Booking" (
    "id" UUID NOT NULL,
    "vendorId" UUID NOT NULL,
    "vehicleId" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "fare" DOUBLE PRECISION NOT NULL,
    "status" "BookingStatus" NOT NULL DEFAULT 'requested',
    "pickupAddress" TEXT NOT NULL DEFAULT '',
    "dropAddress" TEXT NOT NULL DEFAULT '',
    "pickupLocation" JSONB,
    "dropLocation" JSONB,
    "userMobileNumber" TEXT NOT NULL DEFAULT '',
    "driverMobileNumber" TEXT NOT NULL DEFAULT '',
    "paymentStatus" "PaymentStatus" NOT NULL DEFAULT 'pending',
    "paymentMethod" TEXT,
    "paymentOrderId" TEXT,
    "paymentDeadline" TIMESTAMP(3),
    "pickupOtp" TEXT,
    "dropOtp" TEXT,
    "pickupAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Booking_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserProfile" (
    "userId" UUID NOT NULL,
    "name" TEXT,
    "phone" TEXT,
    "photoUrl" TEXT,
    "addressLine1" TEXT,
    "addressLine2" TEXT,
    "city" TEXT,
    "state" TEXT,
    "postalCode" TEXT,
    "country" TEXT,
    "contactDetails" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserProfile_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "UserAccount" (
    "userId" UUID NOT NULL,
    "status" "AccountStatus" NOT NULL DEFAULT 'active',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserAccount_pkey" PRIMARY KEY ("userId")
);

-- CreateTable
CREATE TABLE "AccountRequest" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "type" "AccountRequestType" NOT NULL,
    "status" "AccountRequestStatus" NOT NULL DEFAULT 'pending',
    "previousStatus" "AccountStatus",
    "note" TEXT,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "resolvedAt" TIMESTAMP(3),

    CONSTRAINT "AccountRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AccountAuditEvent" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "actorId" UUID NOT NULL,
    "action" TEXT NOT NULL,
    "details" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AccountAuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "signup_risk_evaluations" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email_normalized" VARCHAR(255),
    "flow_intent" "auth_flow_intent" NOT NULL,
    "edge_request_id" VARCHAR(128) NOT NULL,
    "waf_bot_score" INTEGER,
    "waf_bot_signals" text[],
    "waf_ip_reputation" VARCHAR(64),
    "waf_security_action" "waf_security_action" NOT NULL,
    "waf_challenge_type" "waf_challenge_type",
    "waf_challenge_status" "waf_challenge_status" NOT NULL DEFAULT 'NOT_APPLICABLE',
    "waf_rate_limit_triggered" BOOLEAN NOT NULL DEFAULT false,
    "nginx_request_id" VARCHAR(128) NOT NULL,
    "client_ip" INET NOT NULL,
    "peer_ip" INET NOT NULL,
    "request_method" VARCHAR(10) NOT NULL,
    "request_uri" VARCHAR(512) NOT NULL,
    "connection_concurrency" INTEGER,
    "connection_limit_status" "nginx_limit_status" NOT NULL,
    "local_rate_limit_outcome" "nginx_limit_status" NOT NULL,
    "gateway_request_id" VARCHAR(128) NOT NULL,
    "gateway_rate_limit_status" "gateway_decision_status" NOT NULL,
    "gateway_policy_status" "gateway_policy_status" NOT NULL,
    "upstream_service" VARCHAR(100) NOT NULL DEFAULT 'AUTH_SERVICE',
    "device_fingerprint_hash" CHAR(64) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "coarse_location" VARCHAR(120),
    "is_disposable_email" BOOLEAN NOT NULL DEFAULT false,
    "is_rate_or_subnet_surge" BOOLEAN NOT NULL DEFAULT false,
    "total_risk_score" INTEGER NOT NULL,
    "decision" "risk_decision" NOT NULL,
    "risk_otp_challenge_id" UUID,
    "risk_otp_passed" BOOLEAN,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "signup_risk_evaluations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "otp_challenges" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email_normalized" VARCHAR(255) NOT NULL,
    "purpose" "otp_purpose" NOT NULL,
    "originating_flow" "otp_originating_flow" NOT NULL,
    "originating_flow_intent" "auth_flow_intent" NOT NULL,
    "otp_hash" CHAR(64) NOT NULL,
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "max_attempts" INTEGER NOT NULL DEFAULT 5,
    "is_locked" BOOLEAN NOT NULL DEFAULT false,
    "pending_oauth_provider" "oauth_provider",
    "pending_oauth_sub" VARCHAR(255),
    "pending_oauth_name" VARCHAR(120),
    "request_ip" INET NOT NULL,
    "device_fingerprint_hash" CHAR(64) NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "otp_challenges_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "trusted_devices" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "device_fingerprint_hash" CHAR(64) NOT NULL,
    "browser" VARCHAR(80),
    "os" VARCHAR(80),
    "user_agent" TEXT NOT NULL,
    "last_ip" INET NOT NULL,
    "coarse_location" VARCHAR(120),
    "is_initial_signup_device" BOOLEAN NOT NULL DEFAULT false,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "last_seen_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "trusted_until" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "trusted_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_sessions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "trusted_device_id" UUID,
    "family_id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "client_ip" INET NOT NULL,
    "device_fingerprint_hash" CHAR(64) NOT NULL,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "revoked_at" TIMESTAMPTZ(6),
    "revoke_reason" "session_revoke_reason",
    "last_active_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "refresh_tokens" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "session_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "family_id" UUID NOT NULL,
    "token_hash" CHAR(64) NOT NULL,
    "parent_token_id" UUID,
    "is_revoked" BOOLEAN NOT NULL DEFAULT false,
    "used_at" TIMESTAMPTZ(6),
    "revoked_at" TIMESTAMPTZ(6),
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "refresh_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_pkce_states" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "state_hash" CHAR(64) NOT NULL,
    "code_verifier_encrypted" TEXT NOT NULL,
    "code_challenge" VARCHAR(128) NOT NULL,
    "code_challenge_method" VARCHAR(10) NOT NULL DEFAULT 'S256',
    "flow_intent" "auth_flow_intent" NOT NULL,
    "was_risk_checked" BOOLEAN NOT NULL DEFAULT false,
    "risk_evaluation_id" UUID,
    "redirect_uri" TEXT NOT NULL,
    "client_ip" inet NOT NULL,
    "device_fingerprint_hash" CHAR(64) NOT NULL,
    "user_agent" TEXT NOT NULL,
    "expires_at" TIMESTAMPTZ(6) NOT NULL,
    "consumed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_pkce_states_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "oauth_identities" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "provider" "oauth_provider" NOT NULL DEFAULT 'GOOGLE',
    "provider_user_id" VARCHAR(255) NOT NULL,
    "provider_email" VARCHAR(255) NOT NULL,
    "provider_email_verified" BOOLEAN NOT NULL DEFAULT true,
    "provider_name" VARCHAR(120),
    "linked_via" "oauth_link_method" NOT NULL,
    "last_used_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "oauth_identities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_audit_logs" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID,
    "email_attempted" VARCHAR(255),
    "event_type" "security_event_type" NOT NULL,
    "flow_intent" "auth_flow_intent",
    "nginx_request_id" VARCHAR(128),
    "client_ip" INET NOT NULL,
    "device_fingerprint_hash" CHAR(64),
    "user_agent" TEXT,
    "metadata" JSONB,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "idx_users_email_unique" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "users_vehicleId_key" ON "users"("vehicleId");

-- CreateIndex
CREATE INDEX "users_role_idx" ON "users"("role");

-- CreateIndex
CREATE INDEX "idx_users_status_verified" ON "users"("account_status", "is_verified");

-- CreateIndex
CREATE INDEX "idx_users_deleted_at" ON "users"("deleted_at");

-- CreateIndex
CREATE INDEX "idx_users_mfa_lockout" ON "users"("account_status", "mfa_locked_until");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_ownerId_key" ON "Vehicle"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "Vehicle_number_key" ON "Vehicle"("number");

-- CreateIndex
CREATE INDEX "Vehicle_status_idx" ON "Vehicle"("status");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerBank_ownerId_key" ON "PartnerBank"("ownerId");

-- CreateIndex
CREATE UNIQUE INDEX "PartnerDocs_ownerId_key" ON "PartnerDocs"("ownerId");

-- CreateIndex
CREATE INDEX "Booking_vendorId_idx" ON "Booking"("vendorId");

-- CreateIndex
CREATE INDEX "Booking_vehicleId_idx" ON "Booking"("vehicleId");

-- CreateIndex
CREATE INDEX "Booking_status_idx" ON "Booking"("status");

-- CreateIndex
CREATE INDEX "Booking_completedAt_idx" ON "Booking"("completedAt");

-- CreateIndex
CREATE INDEX "Booking_vendorId_completedAt_status_idx" ON "Booking"("vendorId", "completedAt", "status");

-- CreateIndex
CREATE INDEX "AccountRequest_userId_requestedAt_idx" ON "AccountRequest"("userId", "requestedAt");

-- CreateIndex
CREATE INDEX "AccountAuditEvent_userId_createdAt_idx" ON "AccountAuditEvent"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "idx_risk_eval_email" ON "signup_risk_evaluations"("email_normalized");

-- CreateIndex
CREATE INDEX "idx_risk_eval_ip" ON "signup_risk_evaluations"("client_ip");

-- CreateIndex
CREATE INDEX "idx_risk_eval_device_fp" ON "signup_risk_evaluations"("device_fingerprint_hash");

-- CreateIndex
CREATE INDEX "idx_risk_eval_created_at" ON "signup_risk_evaluations"("created_at");

-- CreateIndex
CREATE INDEX "idx_risk_eval_edge_request" ON "signup_risk_evaluations"("edge_request_id");

-- CreateIndex
CREATE INDEX "idx_risk_eval_nginx_request" ON "signup_risk_evaluations"("nginx_request_id");

-- CreateIndex
CREATE INDEX "idx_risk_eval_gateway_request" ON "signup_risk_evaluations"("gateway_request_id");

-- CreateIndex
CREATE INDEX "idx_risk_eval_flow_intent" ON "signup_risk_evaluations"("flow_intent");

-- CreateIndex
CREATE INDEX "idx_risk_eval_decision" ON "signup_risk_evaluations"("decision");

-- CreateIndex
CREATE INDEX "idx_otp_user_purpose_used" ON "otp_challenges"("user_id", "purpose", "used_at");

-- CreateIndex
CREATE INDEX "idx_otp_email_purpose_expiry" ON "otp_challenges"("email_normalized", "purpose", "expires_at");

-- CreateIndex
CREATE INDEX "idx_otp_expiry" ON "otp_challenges"("expires_at");

-- CreateIndex
CREATE INDEX "idx_otp_device_created" ON "otp_challenges"("device_fingerprint_hash", "created_at");

-- CreateIndex
CREATE INDEX "idx_trusted_devices_active_lookup" ON "trusted_devices"("user_id", "is_revoked", "trusted_until");

-- CreateIndex
CREATE UNIQUE INDEX "idx_trusted_devices_user_fp_unique" ON "trusted_devices"("user_id", "device_fingerprint_hash");

-- CreateIndex
CREATE UNIQUE INDEX "user_sessions_family_id_key" ON "user_sessions"("family_id");

-- CreateIndex
CREATE INDEX "idx_sessions_user_active_fifo" ON "user_sessions"("user_id", "is_active", "created_at");

-- CreateIndex
CREATE INDEX "idx_sessions_family_id" ON "user_sessions"("family_id");

-- CreateIndex
CREATE UNIQUE INDEX "refresh_tokens_token_hash_key" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_hash" ON "refresh_tokens"("token_hash");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_family" ON "refresh_tokens"("family_id");

-- CreateIndex
CREATE INDEX "idx_refresh_tokens_session_active" ON "refresh_tokens"("session_id", "is_revoked");

-- CreateIndex
CREATE UNIQUE INDEX "oauth_pkce_states_state_hash_key" ON "oauth_pkce_states"("state_hash");

-- CreateIndex
CREATE INDEX "idx_oauth_pkce_state_hash" ON "oauth_pkce_states"("state_hash");

-- CreateIndex
CREATE INDEX "idx_oauth_pkce_expires_at" ON "oauth_pkce_states"("expires_at");

-- CreateIndex
CREATE INDEX "idx_oauth_provider_email" ON "oauth_identities"("provider_email");

-- CreateIndex
CREATE UNIQUE INDEX "idx_oauth_provider_sub_unique" ON "oauth_identities"("provider", "provider_user_id");

-- CreateIndex
CREATE UNIQUE INDEX "idx_oauth_user_provider_unique" ON "oauth_identities"("user_id", "provider");

-- CreateIndex
CREATE INDEX "idx_audit_user_time" ON "auth_audit_logs"("user_id", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_event_time" ON "auth_audit_logs"("event_type", "created_at");

-- CreateIndex
CREATE INDEX "idx_audit_client_ip" ON "auth_audit_logs"("client_ip");

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Vehicle" ADD CONSTRAINT "Vehicle_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerBank" ADD CONSTRAINT "PartnerBank_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PartnerDocs" ADD CONSTRAINT "PartnerDocs_ownerId_fkey" FOREIGN KEY ("ownerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vendorId_fkey" FOREIGN KEY ("vendorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_vehicleId_fkey" FOREIGN KEY ("vehicleId") REFERENCES "Vehicle"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountRequest" ADD CONSTRAINT "AccountRequest_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AccountAuditEvent" ADD CONSTRAINT "AccountAuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "UserAccount"("userId") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signup_risk_evaluations" ADD CONSTRAINT "signup_risk_evaluations_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "signup_risk_evaluations" ADD CONSTRAINT "signup_risk_evaluations_risk_otp_challenge_id_fkey" FOREIGN KEY ("risk_otp_challenge_id") REFERENCES "otp_challenges"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "otp_challenges" ADD CONSTRAINT "otp_challenges_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "trusted_devices" ADD CONSTRAINT "trusted_devices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_sessions" ADD CONSTRAINT "user_sessions_trusted_device_id_fkey" FOREIGN KEY ("trusted_device_id") REFERENCES "trusted_devices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_fkey" FOREIGN KEY ("session_id") REFERENCES "user_sessions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_parent_token_id_fkey" FOREIGN KEY ("parent_token_id") REFERENCES "refresh_tokens"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_pkce_states" ADD CONSTRAINT "oauth_pkce_states_risk_evaluation_id_fkey" FOREIGN KEY ("risk_evaluation_id") REFERENCES "signup_risk_evaluations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "oauth_identities" ADD CONSTRAINT "oauth_identities_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_audit_logs" ADD CONSTRAINT "auth_audit_logs_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

