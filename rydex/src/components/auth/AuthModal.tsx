"use client";

import { AnimatePresence, motion } from "framer-motion";
import { X } from "lucide-react";
import Image from "next/image";
import { useEffect } from "react";
import { LoginForm } from "./LoginForm";
import { OtpForm } from "./OtpForm";
import { SignupForm } from "./SignupForm";
import { useAuthModal } from "@/hooks/useAuthModal";

type Props = {
  open: boolean;
  onClose: () => void;
};

export default function AuthModal({ open, onClose }: Props) {
  const auth = useAuthModal(open, onClose);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={auth.handleClose}
            className="fixed inset-0 z-[90] bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 40 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 40 }}
            transition={{ duration: 0.35, ease: "easeOut" }}
            className="fixed inset-0 z-[100] flex items-center justify-center px-4"
          >
            <div className="relative w-full max-w-md rounded-3xl border border-black/10 bg-white p-6 text-black shadow-[0_40px_100px_rgba(0,0,0,0.35)] sm:p-8">
              <button
                onClick={auth.handleClose}
                className="absolute right-4 top-4 text-gray-500 transition hover:text-black"
                aria-label="Close authentication"
              >
                <X size={20} />
              </button>

              <div className="mb-6 text-center">
                <h1 className="text-3xl font-extrabold tracking-widest">RYDEX</h1>
                <p className="mt-1 text-xs text-gray-500">Premium Vehicle Booking</p>
              </div>

              <button
                onClick={auth.handleGoogleLogin}
                disabled={auth.loading}
                className="flex h-11 w-full items-center justify-center gap-3 rounded-xl border border-black/20 text-sm font-semibold transition hover:bg-black hover:text-white disabled:opacity-60"
              >
                <Image src="/google.png" alt="" width={20} height={20} />
                Continue with Google
              </button>

              <div className="my-6 flex items-center gap-4">
                <span className="h-px flex-1 bg-black/10" />
                <span className="text-xs text-gray-500">OR</span>
                <span className="h-px flex-1 bg-black/10" />
              </div>

              <AnimatePresence mode="wait">
                {auth.step === "login" && (
                  <LoginForm
                    email={auth.email}
                    password={auth.password}
                    showPassword={auth.showPassword}
                    loading={auth.loading}
                    onEmailChange={auth.setEmail}
                    onPasswordChange={auth.setPassword}
                    onTogglePassword={auth.togglePasswordVisibility}
                    onLogin={auth.handleLogin}
                    onSwitchToSignup={auth.switchToSignup}
                  />
                )}

                {auth.step === "signup" && (
                  <SignupForm
                    name={auth.name}
                    email={auth.email}
                    password={auth.password}
                    loading={auth.loading}
                    onNameChange={auth.setName}
                    onEmailChange={auth.setEmail}
                    onPasswordChange={auth.setPassword}
                    onSignup={auth.handleSignUp}
                    onSwitchToLogin={auth.switchToLogin}
                  />
                )}

                {auth.step === "otp" && (
                  <OtpForm
                    mode={auth.otpMode}
                    otp={auth.otp}
                    inputRefs={auth.otpRefs}
                    loading={auth.loading}
                    resendSeconds={auth.resendSeconds}
                    onOtpChange={auth.handleOtpChange}
                    onVerify={auth.handleVerifyOtp}
                    onResend={auth.handleResendOtp}
                  />
                )}
              </AnimatePresence>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
