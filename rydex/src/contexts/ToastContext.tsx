"use client";

/**
 * ToastContext — global popup message system for Rydex.
 *
 * Usage anywhere in the app:
 *   const { toast } = useToast();
 *   toast.success("Signed up successfully!");
 *   toast.error("Invalid OTP. Please try again.");
 *   toast.info("Verification email has been resent.");
 *   toast.warning("Session is about to expire.");
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";

// ─── Types ───────────────────────────────────────────────────────────────────

export type ToastType = "success" | "error" | "info" | "warning";

export interface ToastMessage {
  id: string;
  type: ToastType;
  message: string;
  /** Auto-dismiss delay in ms. Default: 4000. Pass 0 to disable auto-dismiss. */
  duration?: number;
}

interface ToastContextValue {
  toasts: ToastMessage[];
  dismiss: (id: string) => void;
  toast: {
    success: (message: string, duration?: number) => void;
    error: (message: string, duration?: number) => void;
    info: (message: string, duration?: number) => void;
    warning: (message: string, duration?: number) => void;
  };
}

// ─── Context ─────────────────────────────────────────────────────────────────

const ToastContext = createContext<ToastContextValue | null>(null);

// ─── Provider ────────────────────────────────────────────────────────────────

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  // Keep timers so we can clear them on manual dismiss
  const timers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  const dismiss = useCallback((id: string) => {
    // Clear any pending auto-dismiss timer
    const timer = timers.current.get(id);
    if (timer !== undefined) {
      clearTimeout(timer);
      timers.current.delete(id);
    }
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const show = useCallback(
    (type: ToastType, message: string, duration = 4000) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      setToasts((prev) => [...prev, { id, type, message, duration }]);

      if (duration > 0) {
        const timer = setTimeout(() => dismiss(id), duration);
        timers.current.set(id, timer);
      }
    },
    [dismiss]
  );

  const toast = {
    success: (message: string, duration?: number) =>
      show("success", message, duration),
    error: (message: string, duration?: number) =>
      show("error", message, duration),
    info: (message: string, duration?: number) =>
      show("info", message, duration),
    warning: (message: string, duration?: number) =>
      show("warning", message, duration),
  };

  return (
    <ToastContext.Provider value={{ toasts, dismiss, toast }}>
      {children}
    </ToastContext.Provider>
  );
}

// ─── Hook ────────────────────────────────────────────────────────────────────

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error("useToast must be used inside <ToastProvider>.");
  }
  return ctx;
}
