import { motion } from "framer-motion";
import type { OtpMode } from "@/types/auth.types";

type Props = {
  mode: OtpMode;
  otp: string[];
  inputRefs: { current: Array<HTMLInputElement | null> };
  loading: boolean;
  resendSeconds: number;
  recoveryContinuation: boolean;
  onOtpChange: (index: number, value: string) => void;
  onVerify: () => void;
  onResend: () => void;
};

const titleByMode: Record<OtpMode, string> = {
  EMAIL_VERIFICATION: "Verify email",
  RISK_OTP_VERIFICATION: "Security verification",
  ACCOUNT_RECOVERY: "Verify account recovery",
  STEP_UP_MFA: "Verify new device",
  ACCOUNT_RECOVERY_MFA: "Verify account recovery",
};

const verifyLabelByMode: Record<OtpMode, string> = {
  EMAIL_VERIFICATION: "Verify Email",
  RISK_OTP_VERIFICATION: "Verify & Continue",
  ACCOUNT_RECOVERY: "Verify Recovery Code",
  STEP_UP_MFA: "Verify Sign-In",
  ACCOUNT_RECOVERY_MFA: "Verify Recovery Code",
};

export function OtpForm({
  mode,
  otp,
  inputRefs,
  loading,
  resendSeconds,
  recoveryContinuation,
  onOtpChange,
  onVerify,
  onResend,
}: Props) {
  return (
    <motion.div
      key="otp"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="text-xl font-semibold">
        {recoveryContinuation ? "Recovery verification complete" : titleByMode[mode]}
      </h2>

      {recoveryContinuation ? (
        <p className="mt-4 rounded-xl bg-amber-50 p-4 text-sm text-amber-900">
          Your email is verified. Restoring a recently deleted account requires an additional recovery step, which is not available in this flow yet. The account has not been restored.
        </p>
      ) : (
        <>
          <div className="mt-6 flex justify-between gap-2">
            {otp.map((digit, index) => (
              <input
                key={index}
                ref={(element) => { inputRefs.current[index] = element; }}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                value={digit}
                onChange={(event) => onOtpChange(index, event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Backspace" && !otp[index] && index > 0) {
                    inputRefs.current[index - 1]?.focus();
                  }
                }}
                aria-label={`Verification digit ${index + 1}`}
                className="h-12 w-10 rounded-xl border border-black/20 bg-white text-center text-lg font-semibold outline-none sm:w-12"
              />
            ))}
          </div>

          <button
            onClick={onVerify}
            disabled={loading}
            className="mt-6 h-11 w-full rounded-xl bg-black font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {verifyLabelByMode[mode]}
          </button>

          <div className="mt-4 text-center">
            <button
              onClick={onResend}
              disabled={loading || resendSeconds > 0}
              className="text-sm font-medium text-black hover:underline disabled:cursor-not-allowed disabled:opacity-60"
            >
              {resendSeconds > 0 ? `Resend code in ${resendSeconds}s` : "Resend OTP"}
            </button>
          </div>
        </>
      )}
    </motion.div>
  );
}
