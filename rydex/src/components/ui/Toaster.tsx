"use client";

/**
 * Toaster — renders all active toast popups in a fixed portal.
 * Place <Toaster /> once inside your root layout (inside <ToastProvider>).
 *
 * Toast types:
 *   success  → green
 *   error    → red
 *   info     → blue
 *   warning  → amber
 */

import { AnimatePresence, motion } from "framer-motion";
import {
  AlertTriangle,
  CheckCircle2,
  Info,
  X,
  XCircle,
} from "lucide-react";
import { useToast, type ToastMessage, type ToastType } from "@/contexts/ToastContext";

// ─── Styling maps ────────────────────────────────────────────────────────────

const STYLES: Record<
  ToastType,
  { container: string; icon: string; bar: string }
> = {
  success: {
    container:
      "border-green-200 bg-white text-green-800 shadow-green-100",
    icon: "text-green-500",
    bar: "bg-green-400",
  },
  error: {
    container:
      "border-red-200 bg-white text-red-800 shadow-red-100",
    icon: "text-red-500",
    bar: "bg-red-400",
  },
  info: {
    container:
      "border-blue-200 bg-white text-blue-800 shadow-blue-100",
    icon: "text-blue-500",
    bar: "bg-blue-400",
  },
  warning: {
    container:
      "border-amber-200 bg-white text-amber-800 shadow-amber-100",
    icon: "text-amber-500",
    bar: "bg-amber-400",
  },
};

const ICONS: Record<ToastType, React.ReactElement> = {
  success: <CheckCircle2 size={18} />,
  error: <XCircle size={18} />,
  info: <Info size={18} />,
  warning: <AlertTriangle size={18} />,
};

// ─── Single Toast ─────────────────────────────────────────────────────────────

function Toast({
  toast,
  onDismiss,
}: {
  toast: ToastMessage;
  onDismiss: (id: string) => void;
}) {
  const style = STYLES[toast.type];
  const duration = toast.duration ?? 4000;

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: -20, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -16, scale: 0.95 }}
      transition={{ duration: 0.25, ease: "easeOut" }}
      className={`relative flex w-full max-w-sm items-start gap-3 overflow-hidden rounded-2xl border px-4 py-3 shadow-lg ${style.container}`}
      role="alert"
      aria-live="polite"
    >
      {/* Type icon */}
      <span className={`mt-0.5 shrink-0 ${style.icon}`}>
        {ICONS[toast.type]}
      </span>

      {/* Message */}
      <p className="flex-1 text-sm font-medium leading-snug">{toast.message}</p>

      {/* Close button */}
      <button
        onClick={() => onDismiss(toast.id)}
        className="shrink-0 rounded-full p-0.5 opacity-50 transition hover:opacity-100"
        aria-label="Dismiss notification"
      >
        <X size={14} />
      </button>

      {/* Auto-dismiss progress bar */}
      {duration > 0 && (
        <motion.div
          className={`absolute bottom-0 left-0 h-[3px] ${style.bar}`}
          initial={{ width: "100%" }}
          animate={{ width: "0%" }}
          transition={{ duration: duration / 1000, ease: "linear" }}
        />
      )}
    </motion.div>
  );
}

// ─── Toaster container ───────────────────────────────────────────────────────

export function Toaster() {
  const { toasts, dismiss } = useToast();

  return (
    /* Fixed portal — top-right on desktop, top-centre on mobile */
    <div
      aria-label="Notifications"
      className="pointer-events-none fixed right-0 top-4 z-[200] flex w-full flex-col items-end gap-2 px-4 sm:max-w-sm"
    >
      <AnimatePresence initial={false}>
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto w-full">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </AnimatePresence>
    </div>
  );
}
