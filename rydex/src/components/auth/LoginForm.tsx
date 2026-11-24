import { motion } from "framer-motion";
import { Eye, EyeOff, Lock, Mail } from "lucide-react";

type Props = {
  email: string;
  password: string;
  showPassword: boolean;
  loading: boolean;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onTogglePassword: () => void;
  onLogin: () => void;
  onSwitchToSignup: () => void;
};

export function LoginForm({
  email,
  password,
  showPassword,
  loading,
  onEmailChange,
  onPasswordChange,
  onTogglePassword,
  onLogin,
  onSwitchToSignup,
}: Props) {
  return (
    <motion.div
      key="login"
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
    >
      <h2 className="text-xl font-semibold">Welcome back</h2>

      <div className="mt-5 space-y-4">
        <label className="flex items-center gap-3 rounded-xl border border-black/20 px-4 py-3">
          <Mail size={18} className="text-gray-500" />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => onEmailChange(event.target.value)}
            className="w-full bg-transparent text-sm outline-none"
          />
        </label>

        <div className="flex items-center gap-3 rounded-xl border border-black/20 px-4 py-3">
          <Lock size={18} className="text-gray-500" />
          <input
            type={showPassword ? "text" : "password"}
            placeholder="Password"
            value={password}
            onChange={(event) => onPasswordChange(event.target.value)}
            aria-label="Password"
            className="w-full bg-transparent text-sm outline-none"
          />
          <button type="button" onClick={onTogglePassword} className="text-gray-500" aria-label={showPassword ? "Hide password" : "Show password"}>
            {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>

        <button
          onClick={onLogin}
          disabled={loading}
          className="h-11 w-full rounded-xl bg-black font-semibold text-white transition hover:bg-gray-900 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Login
        </button>
      </div>

      <p className="mt-6 text-center text-sm text-gray-500">
        Don’t have an account?{" "}
        <button onClick={onSwitchToSignup} className="font-medium text-black hover:underline">
          Sign up
        </button>
      </p>
    </motion.div>
  );
}
