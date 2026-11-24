import React from "react";
import { motion } from "framer-motion";
import { Clock, TrendingUp, TrendingDown, Minus } from "lucide-react";

const KPI_CONFIG: Record<string, {
  iconBg: string;
  iconColor: string;
  cardHover: string;
}> = {
  totalVendors: {
    iconBg: "bg-purple-50",
    iconColor: "text-purple-700",
    cardHover: "hover:shadow-purple-100/60",
  },
  approved: {
    iconBg: "bg-blue-50",
    iconColor: "text-blue-800",
    cardHover: "hover:shadow-blue-100/60",
  },
  pending: {
    iconBg: "bg-amber-50",
    iconColor: "text-amber-800",
    cardHover: "hover:shadow-amber-100/60",
  },
  rejected: {
    iconBg: "bg-red-50",
    iconColor: "text-red-800",
    cardHover: "hover:shadow-red-100/60",
  },
};

const TREND_STYLES: Record<string, { color: string; icon: React.ReactNode }> = {
  up:   { color: "bg-green-50 text-green-800",  icon: <TrendingUp size={11} /> },
  down: { color: "bg-red-50 text-red-800",      icon: <TrendingDown size={11} /> },
  flat: { color: "bg-gray-100 text-gray-600",   icon: <Minus size={11} /> },
};

interface KpiCardProps {
  label: string;
  value: number;
  icon: React.ReactNode;
  trend?: string;
  trendDir?: "up" | "down" | "flat";
  sub?: string;
  variant?: keyof typeof KPI_CONFIG;
}

export default function KpiCard({
  label,
  value,
  icon,
  trend,
  trendDir = "up",
  sub,
  variant = "totalVendors",
}: KpiCardProps) {
  const cfg = KPI_CONFIG[variant];
  const { color: trendColor, icon: trendIcon } = TREND_STYLES[trendDir];

  return (
    <motion.div
      whileHover={{ y: -5, boxShadow: "0 20px 48px rgba(0,0,0,0.10)" }}
      transition={{ type: "spring", stiffness: 300, damping: 20 }}
      className={`bg-white rounded-2xl p-5 border border-gray-100 shadow-sm
        cursor-default relative overflow-hidden group ${cfg.cardHover}`}
    >
      {/* Subtle tinted bg on hover */}
      <div
        className={`absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity duration-300 rounded-2xl ${cfg.iconBg}`}
        style={{ zIndex: 0 }}
      />

      <div className="relative z-10">
        {/* Icon + trend badge */}
        <div className="flex items-start justify-between mb-4">
          <motion.div
            whileHover={{ rotate: -6, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 400 }}
            className={`w-11 h-11 rounded-xl flex items-center justify-center ${cfg.iconBg} ${cfg.iconColor}`}
          >
            {icon}
          </motion.div>

          {trend && (
            <span className={`inline-flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-full ${trendColor}`}>
              {trendIcon}
              {trend}
            </span>
          )}
        </div>

        {/* Label */}
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-1">
          {label}
        </p>

        {/* Value */}
        <motion.p
          className="text-3xl font-extrabold text-gray-950 leading-tight"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4, delay: 0.1 }}
        >
          {value}
        </motion.p>

        {/* Footer */}
        {sub && (
          <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
            <p className="text-[11px] text-gray-400">{sub}</p>
            <Clock size={11} className="text-gray-300" />
          </div>
        )}
      </div>
    </motion.div>
  );
}
