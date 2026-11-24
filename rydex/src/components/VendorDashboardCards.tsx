"use client";

import { motion } from "framer-motion";
import { AlertTriangle } from "lucide-react";

/* ================= STATUS CARD ================= */
export function StatusCard({ icon, title, desc }: any) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="
        bg-white 
        rounded-2xl md:rounded-3xl 
        p-5 sm:p-6 md:p-8 
        shadow-lg 
        border 
        flex 
        flex-col sm:flex-row 
        gap-4 sm:gap-5
        items-start sm:items-center
      "
    >
      <div className="bg-black text-white p-3 md:p-4 rounded-xl shrink-0">
        {icon}
      </div>

      <div className="flex-1">
        <h3 className="text-base sm:text-lg md:text-xl font-semibold">
          {title}
        </h3>
        <p className="text-gray-600 text-sm sm:text-base mt-1">
          {desc}
        </p>
      </div>
    </motion.div>
  );
}

/* ================= ACTION CARD ================= */
export function ActionCard({ icon, title, button, onClick }: any) {
  return (
    <div
      className="
        bg-white 
        rounded-2xl md:rounded-3xl 
        p-5 sm:p-6 md:p-8 
        shadow-lg 
        border 
        flex 
        flex-col sm:flex-row 
        justify-between 
        items-start sm:items-center 
        gap-5
      "
    >
      <div className="flex items-center gap-4">
        <div className="bg-black text-white p-3 md:p-4 rounded-xl shrink-0">
          {icon}
        </div>

        <h3 className="text-base sm:text-lg md:text-xl font-semibold">
          {title}
        </h3>
      </div>

      <button
        onClick={onClick}
        className="
          w-full sm:w-auto
          bg-black 
          text-white 
          px-6 
          py-2.5 
          rounded-xl 
          text-sm sm:text-base 
          font-medium
          transition 
          hover:bg-gray-800
        "
      >
        {button}
      </button>
    </div>
  );
}

/* ================= REJECTION CARD ================= */
export function RejectionCard({
  title,
  reason,
  actionLabel,
  onAction,
}: any) {
  return (
    <div
      className="
        bg-red-50 
        border border-red-200 
        rounded-2xl md:rounded-3xl 
        p-5 sm:p-6 md:p-8 
        space-y-4
      "
    >
      <div className="flex items-center gap-2 text-red-600 font-semibold text-sm sm:text-base">
        <AlertTriangle size={18} />
        {title}
      </div>

      <div className="bg-white border rounded-xl p-4 text-sm sm:text-base">
        {reason || "No reason provided"}
      </div>

      {onAction && (
        <button
          onClick={onAction}
          className="
            w-full sm:w-auto
            px-6 
            py-2.5 
            bg-black 
            text-white 
            rounded-xl 
            text-sm sm:text-base
            font-medium
            hover:bg-gray-800 
            transition
          "
        >
          {actionLabel || "Retry"}
        </button>
      )}
    </div>
  );
}
