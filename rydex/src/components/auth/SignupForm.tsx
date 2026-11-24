import { motion } from "framer-motion";
import { Lock, Mail, User } from "lucide-react";

type Props = {
  name: string;
  email: string;
  password: string;
  loading: boolean;
  onNameChange: (value: string) => void;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSignup: () => void;
  onSwitchToLogin: () => void;
};

export function SignupForm({
  name,
  email,
  password,
  loading,
  onNameChange,
  onEmailChange,
  onPasswordChange,
  onSignup,
  onSwitchToLogin,
}: Props) {
  return (
    <motion.div
      key="signup"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="text-xl font-semibold">Create account</h2>

      <div className="mt-5 space-y-4">
        <label className="flex items-center gap-3 rounded-xl border border-black/20 px-4 py-3">
          <User size={18} className="text-gray-500" />
          <input
            placeholder="Full name"
            value={name}
            onChange={(event) => onNameChange(event.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-black/20 px-4 py-3">
          <Mail size={18} className="text-gray-500" />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <label className="flex items-center gap-3 rounded-xl border border-black/20 px-4 py-3">
          <Lock size={18} className="text-gray-500" />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <button
          onClick={onSignup}
          disabled={loading}
          className="h-11 w-full rounded-xl bg-black font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send OTP
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Already have an account?{" "}
        <button onClick={onSwitchToLogin} className="font-medium text-black hover:underline">
          Login
        </button>
      </p>
    </motion.div>
  );
}
