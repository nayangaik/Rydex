"use client";

import api from "@/lib/api";
import { useAuth } from "@/contexts/AuthContext";
import { setUserData } from "@/redux/userSlice";
import { useDispatch } from "react-redux";
import type { AppDispatch } from "@/redux/store";
import type { AxiosError } from "axios";
import { useEffect, useRef, useState } from "react";
import { signIn } from "next-auth/react";
import type { AuthNextStep, AuthResponse, AuthStep, OtpMode, SignupCredentials } from "@/types/auth.types";
import { useToast } from "@/contexts/ToastContext";

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const EMPTY_OTP = ["", "", "", "", "", ""];
const OTP_RESEND_COOLDOWN_SECONDS = 60;

function errorData(error: unknown): AuthResponse {
  return (error as AxiosError<AuthResponse>)?.response?.data ?? {};
}

export function useAuthModal(open: boolean, onClose: () => void) {

  const [step, setStep] = useState<AuthStep>("login");
  const [otpMode, setOtpMode] = useState<OtpMode>("EMAIL_VERIFICATION");
  const [resendSeconds, setResendSeconds] = useState(0);
  const [recoveryContinuation, setRecoveryContinuation] = useState(false);
  const signupCredentials = useRef<SignupCredentials | null>(null);
  const otpRefs = useRef<Array<HTMLInputElement | null>>([]);
  const { setAccessToken } = useAuth();
  const dispatch = useDispatch<AppDispatch>();
  const { toast } = useToast();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState(EMPTY_OTP);
  const [loading, setLoading] = useState(false);

  // Reset form state when modal closes
  useEffect(() => {
    if (!open) {
      setLoading(false);
      setStep("login");
      setPassword("");
      setOtp(EMPTY_OTP);
      signupCredentials.current = null;
      setResendSeconds(0);
      setRecoveryContinuation(false);
    }
  }, [open]);

  // OTP resend countdown
  useEffect(() => {
    if (resendSeconds <= 0) return;
    const timer = window.setTimeout(
      () => setResendSeconds((s) => s - 1),
      1000
    );
    return () => window.clearTimeout(timer);
  }, [resendSeconds]);

  // ─── OTP input helpers ────────────────────────────────────────────────────

  const handleOtpChange = (index: number, value: string) => {
    const digits = value.replace(/\D/g, "");

    if (digits.length > 1) {
      const pasted = digits.slice(0, 6).split("");
      const next = [...EMPTY_OTP];
      pasted.forEach((digit, offset) => {
        if (index + offset < next.length) next[index + offset] = digit;
      });
      setOtp(next);
      otpRefs.current[Math.min(index + pasted.length, next.length - 1)]?.focus();
      return;
    }

    const updated = [...otp];
    updated[index] = digits;
    setOtp(updated);
    if (digits && index < updated.length - 1) otpRefs.current[index + 1]?.focus();
  };

  // ─── Auth helpers ─────────────────────────────────────────────────────────

  const finishAuthentication = (data: AuthResponse) => {
    if (!data.accessToken) {
      toast.error(
        "Authentication completed without an access token. Please try signing in again."
      );
      return;
    }

    setAccessToken(data.accessToken);
    const signup = signupCredentials.current;
    const role = data.role?.toUpperCase();
    dispatch(
      setUserData({
        id: data.userId,
        _id: data.userId,
        name: data.name ?? signup?.name,
        email: data.email ?? signup?.email,
        role:
          role === "VENDOR" ? "vendor" : role === "ADMIN" ? "admin" : "user",
      })
    );
    setPassword("");
    setOtp(EMPTY_OTP);
    signupCredentials.current = null;
    setRecoveryContinuation(false);
    toast.success("Welcome to Rydex! You are now signed in.");
    onClose();
  };

  const showOtpStep = (mode: OtpMode, message: string) => {
    setOtpMode(mode);
    setStep("otp");
    setOtp(EMPTY_OTP);
    setRecoveryContinuation(false);
    setResendSeconds(OTP_RESEND_COOLDOWN_SECONDS);
    toast.info(message);
  };

  const applyRegisterResponse = (status: number, data: AuthResponse) => {

    if (status === 201 && data.nextStep === "AUTHENTICATED") {
      finishAuthentication(data);
      return;
    }
    if (
      (status === 201 || status === 202) &&
      data.nextStep === "EMAIL_VERIFICATION"
    ) {
      showOtpStep(
        "EMAIL_VERIFICATION",
        data.message || "A verification code has been sent to your email."
      );
      return;
    }
    if (status === 202 && data.nextStep === "RISK_OTP_VERIFICATION") {
      showOtpStep(
        "RISK_OTP_VERIFICATION",
        data.message ||
        "Additional security verification is required. Enter the code we sent you."
      );
      return;
    }
    if (
      status === 202 &&
      data.nextStep === "ACCOUNT_RECOVERY_VERIFICATION"
    ) {
      showOtpStep(
        "ACCOUNT_RECOVERY",
        data.message || "Verify your account to continue recovery."
      );
      return;
    }
    toast.error(
      data.message ||
      "The server returned an unsupported sign-up step. Please try again."
    );
  };

  // ─── Handlers ─────────────────────────────────────────────────────────────

  const handleLogin = async () => {
    const cleanEmail = email.trim().toLowerCase();
    if (!cleanEmail || !emailPattern.test(cleanEmail)) return toast.error("Please enter a valid email.");
    if (!password) return toast.error("Please enter your password.");

    setLoading(true);
    try {
      const response = await api.post<AuthResponse>("/api/auth/signin", {
        email: cleanEmail,
        password,
      });
      if (response.data.nextStep === "AUTHENTICATED") {
        finishAuthentication(response.data);
      } else if (response.data.nextStep === "EMAIL_VERIFICATION") {
        showOtpStep("EMAIL_VERIFICATION", response.data.message || "Please verify your email to finish signing in.");
      } else if (response.data.nextStep === "STEP_UP_MFA_VERIFICATION") {
        showOtpStep("STEP_UP_MFA", response.data.message || "Verify this device to finish signing in.");
      } else if (response.data.nextStep === "ACCOUNT_RECOVERY_MFA_VERIFICATION") {
        showOtpStep("ACCOUNT_RECOVERY_MFA", response.data.message || "Verify account ownership to recover your account.");
      } else {
        toast.error(response.data.message || "The server returned an unsupported sign-in step.");
      }
    } catch (error: unknown) {
      const data = errorData(error);
      if (data.nextStep === "EMAIL_VERIFICATION") {
        showOtpStep("EMAIL_VERIFICATION", data.message || "Please verify your email to finish signing in.");
      } else if (data.nextStep === "STEP_UP_MFA_VERIFICATION") {
        showOtpStep("STEP_UP_MFA", data.message || "Verify this device to finish signing in.");
      } else if (data.nextStep === "ACCOUNT_RECOVERY_MFA_VERIFICATION") {
        showOtpStep("ACCOUNT_RECOVERY_MFA", data.message || "Verify account ownership to recover your account.");
      } else {
        toast.error(data.message || (error instanceof Error ? error.message : "Login failed."));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    try {
      await signIn("google");
    } catch (error: unknown) {
      toast.error(
        error instanceof Error ? error.message : "Google sign-in failed."
      );
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    const cleanName = name.trim();
    const cleanEmail = email.trim();

    if (!cleanName || cleanName.length > 120)
      return toast.error("Name must be between 1 and 120 characters.");
    if (
      !cleanEmail ||
      cleanEmail.length > 255 ||
      !emailPattern.test(cleanEmail)
    )
      return toast.error(
        "Enter a valid email address (up to 255 characters)."
      );
    if (password.length < 8 || password.length > 128)
      return toast.error("Password must be between 8 and 128 characters.");

    const credentials = { name: cleanName, email: cleanEmail, password };
    signupCredentials.current = credentials;
    setLoading(true);

    try {
      const response = await api.post<AuthResponse>(
        "/api/auth/register",
        credentials
      );
      applyRegisterResponse(response.status, response.data);
    } catch (error: unknown) {
      const data = errorData(error);
      const status = (error as AxiosError).response?.status;
      if (status === 409 && data.action === "CREDENTIALS_SIGNIN") {
        setEmail(cleanEmail);
        setStep("login");
        toast.error(
          data.message || "This account already exists. Please sign in."
        );
      } else if (status === 409 && data.action === "GOOGLE_SIGNIN") {
        toast.error(
          data.message ||
          "This account uses Google. Click Continue with Google to sign in."
        );
      } else {
        toast.error(data.message || "Registration failed. Please try again.");
      }
    } finally {
      setLoading(false);
    }
  };

  const retrySignupAfterRiskCheck = async () => {
    const credentials = signupCredentials.current;
    if (!credentials) {
      setStep("signup");
      toast.error("Please re-submit your sign-up details to continue.");
      return;
    }
    const response = await api.post<AuthResponse>(
      "/api/auth/register",
      credentials
    );
    applyRegisterResponse(response.status, response.data);
  };

  const applyVerificationResponse = async (data: AuthResponse) => {
    if (data.nextStep === "EMAIL_VERIFICATION") {
      showOtpStep("EMAIL_VERIFICATION", data.message || "Please verify your email to finish signing in.");
      return;
    }
    if (data.nextStep === "STEP_UP_MFA_VERIFICATION") {
      showOtpStep("STEP_UP_MFA", data.message || "Verify this device to finish signing in.");
      return;
    }
    switch (data.nextStep) {
      case "RETRY_SIGNUP":
        if (otpMode !== "RISK_OTP_VERIFICATION") {
          toast.error(
            "This code does not match the current verification step. Please request a new code."
          );
          return;
        }
        setOtp(EMPTY_OTP);
        await retrySignupAfterRiskCheck();
        return;
      case "AUTHENTICATED":
        if (otpMode === "RISK_OTP_VERIFICATION") break;
        finishAuthentication(data);
        return;
      case "ACCOUNT_RECOVERY":
        if (otpMode !== "ACCOUNT_RECOVERY") break;
        setOtp(EMPTY_OTP);
        setRecoveryContinuation(true);
        setResendSeconds(0);
        toast.success(
          "Email ownership is verified. Additional recovery verification is required to restore this account."
        );
        return;
    }

    toast.error(
      data.message ||
      "The verification response did not match the current step. Please try again."
    );
  };

  const restartSignupAfterRiskLimit = (message: string) => {
    setStep("signup");
    setOtpMode("EMAIL_VERIFICATION");
    setOtp(EMPTY_OTP);
    setRecoveryContinuation(false);
    setResendSeconds(0);
    toast.error(message);
  };

  const handleVerifyOtpError = (error: unknown) => {
    const status = (error as AxiosError).response?.status;
    const data = errorData(error);

    if (
      otpMode === "RISK_OTP_VERIFICATION" &&
      data.action === "RESTART_SIGNUP"
    ) {
      restartSignupAfterRiskLimit(
        data.message ||
        "Start sign-up again to receive a new verification challenge."
      );
      return;
    }

    if (status === 400 && typeof data.attemptsRemaining === "number") {
      toast.error(
        `${data.message || "Invalid code."} ${data.attemptsRemaining} attempt(s) remaining.`
      );
    } else if (status === 429) {
      toast.error(
        data.message || "Too many attempts. Please wait before trying again."
      );
    } else {
      toast.error(data.message || "Code verification failed.");
    }
  };

  const handleVerifyOtp = async () => {
    const code = otp.join("");
    if (!/^\d{6}$/.test(code))
      return toast.error("Please enter the full 6-digit code.");

    setLoading(true);
    try {
      // otp_challenge_id is HttpOnly — the browser sends it automatically
      const response = await api.post<AuthResponse>(
        "/api/auth/verify-otp",
        { otp: code },
        { withCredentials: true }
      );
      await applyVerificationResponse(response.data);
    } catch (error: unknown) {
      handleVerifyOtpError(error);
    } finally {
      setLoading(false);
    }
  };

  const applyResendResponse = (data: AuthResponse) => {
    const modeByNextStep: Partial<Record<AuthNextStep, OtpMode>> = {
      RISK_OTP_VERIFICATION: "RISK_OTP_VERIFICATION",
      ACCOUNT_RECOVERY_VERIFICATION: "ACCOUNT_RECOVERY",
      ACCOUNT_RECOVERY_MFA_VERIFICATION: "ACCOUNT_RECOVERY_MFA",
      STEP_UP_MFA_VERIFICATION: "STEP_UP_MFA",
      EMAIL_VERIFICATION: "EMAIL_VERIFICATION",
    };
    const nextMode = data.nextStep
      ? modeByNextStep[data.nextStep]
      : undefined;
    if (!nextMode)
      return toast.error("The server returned an unsupported resend step.");

    setOtpMode(nextMode);
    setOtp(EMPTY_OTP);
    setRecoveryContinuation(false);
    toast.success(data.message || "A new verification code has been sent.");
    setResendSeconds(OTP_RESEND_COOLDOWN_SECONDS);
  };

  const handleResendOtp = async () => {
    if (resendSeconds > 0 || loading) return;
    setLoading(true);

    try {
      const response = await api.post<AuthResponse>("/api/auth/resend-otp", {});
      applyResendResponse(response.data);
    } catch (error: unknown) {
      const data = errorData(error);
      if (
        otpMode === "RISK_OTP_VERIFICATION" &&
        data.action === "RESTART_SIGNUP"
      ) {
        restartSignupAfterRiskLimit(
          data.message ||
          "Start sign-up again to receive a new verification challenge."
        );
        return;
      }
      if (typeof data.retryAfterSecs === "number") {
        setResendSeconds(Math.max(0, data.retryAfterSecs));
      }
      toast.error(data.message || "Failed to resend the code.");
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setLoading(false);
    onClose();
  };

  const switchToLogin = () => setStep("login");
  const switchToSignup = () => setStep("signup");
  const togglePasswordVisibility = () => setShowPassword((v) => !v);

  return {
    step,
    setStep,
    otpMode,
    resendSeconds,
    recoveryContinuation,
    otpRefs,
    name,
    setName,
    email,
    setEmail,
    password,
    setPassword,
    showPassword,
    setShowPassword,
    otp,
    loading,
    handleLogin,
    handleGoogleLogin,
    handleSignUp,
    switchToLogin,
    switchToSignup,
    togglePasswordVisibility,
    handleOtpChange,
    handleVerifyOtp,
    handleResendOtp,
    handleClose,
  };
}
