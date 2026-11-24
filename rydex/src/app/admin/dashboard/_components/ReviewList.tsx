import { motion } from "framer-motion";
import { CheckCircle2, Video, ArrowRight } from "lucide-react";
import { useRouter } from "next/navigation";
import axios from "axios";
import { TabType } from "../types";

/* ── Constants ─────────────────────────────────────────────────────────── */

const KYC_STATUS: Record<string, { label: string; pill: string; dot: string }> = {
  pending:     { label: "Pending",     pill: "bg-amber-50 text-amber-800 border border-amber-200",  dot: "bg-amber-500" },
  in_progress: { label: "In Progress", pill: "bg-blue-50  text-blue-800  border border-blue-200",   dot: "bg-blue-500" },
  completed:   { label: "Completed",   pill: "bg-green-50 text-green-800 border border-green-200",  dot: "bg-green-500" },
};

const AVATAR_COLORS = [
  "bg-purple-100 text-purple-800",
  "bg-teal-100 text-teal-800",
  "bg-blue-100 text-blue-800",
  "bg-pink-100 text-pink-800",
];

const QUEUE_LABELS: Record<TabType, string> = {
  kyc:     "Video KYC Queue",
  vendor:  "Vendor Review Queue",
  vehicle: "Vehicle Review Queue",
};

/* ── Empty state ────────────────────────────────────────────────────────── */

function EmptyState() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="bg-white rounded-2xl py-16 text-center border border-dashed border-gray-200 shadow-sm"
    >
      <div className="w-12 h-12 rounded-xl bg-green-50 flex items-center justify-center mx-auto mb-4">
        <CheckCircle2 size={22} className="text-green-500" />
      </div>
      <p className="font-bold text-gray-800 text-base">All caught up!</p>
      <p className="text-sm text-gray-400 mt-1">No pending items right now.</p>
    </motion.div>
  );
}

/* ── Action button ──────────────────────────────────────────────────────── */

interface ActionButtonProps {
  type: TabType;
  item: any;
  onStartKyc: (id: string) => void;
}

function ActionButton({ type, item, onStartKyc }: ActionButtonProps) {
  const router = useRouter();

  if (type === "kyc") {
    if (item.videoKycStatus === "in_progress") {
      return (
        <motion.button
          whileTap={{ scale: 0.96 }}
          animate={{ opacity: [1, 0.7, 1] }}
          transition={{ repeat: Infinity, duration: 1.8 }}
          onClick={() => router.push(`/video-kyc/${item.videoKycRoomId}`)}
          className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors"
        >
          <Video size={13} /> Join Call
        </motion.button>
      );
    }
    return (
      <motion.button
        whileTap={{ scale: 0.96 }}
        onClick={() => onStartKyc(item._id)}
        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold transition-colors"
      >
        <Video size={13} /> Start KYC
      </motion.button>
    );
  }

  return (
    <motion.button
      whileTap={{ scale: 0.96 }}
      onClick={() =>
        router.push(type === "vendor" ? `/admin/vendors/${item._id}` : `/admin/vehicles/${item._id}`)
      }
      className="flex items-center gap-2 px-4 py-2 rounded-xl bg-neutral-950 hover:bg-neutral-800 text-white text-sm font-semibold transition-colors"
    >
      Review <ArrowRight size={13} />
    </motion.button>
  );
}

/* ── Main component ─────────────────────────────────────────────────────── */

interface ReviewListProps {
  data: any[];
  type: TabType;
}

export default function ReviewList({ data, type }: ReviewListProps) {
  const router = useRouter();

  const startKyc = async (vendorId: string) => {
    try {
      const res = await axios.patch(`/api/admin/vendors/video-kyc/start/${vendorId}`);
      if (res.data.roomId) router.push(`/video-kyc/${res.data.roomId}`);
    } catch (err) {
      console.error("Start KYC error:", err);
    }
  };

  if (data.length === 0) return <EmptyState />;

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between px-1 mb-1">
        <p className="text-xs font-semibold uppercase tracking-widest text-gray-400">
          {QUEUE_LABELS[type]}
        </p>
        <p className="text-xs text-gray-400">
          {data.length} item{data.length > 1 ? "s" : ""}
        </p>
      </div>

      {data.map((item: any, i: number) => {
        const name     = item.name || item.ownerName || "—";
        const email    = item.email || item.ownerEmail || "—";
        const initials = name.split(" ").map((w: string) => w[0]).join("").toUpperCase().slice(0, 2);
        const avColor  = AVATAR_COLORS[i % AVATAR_COLORS.length];
        const s        = KYC_STATUS[item.videoKycStatus] ?? KYC_STATUS.pending;

        return (
          <motion.div
            key={item._id}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
            whileHover={{ y: -3, boxShadow: "0 8px 30px rgba(0,0,0,0.08)" }}
            className="bg-white border border-gray-100 rounded-2xl px-5 py-4 flex items-center justify-between gap-4 shadow-sm transition-shadow"
          >
            {/* Avatar + info */}
            <div className="flex items-center gap-3 min-w-0">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold shrink-0 ${avColor}`}>
                {initials}
              </div>
              <div className="min-w-0">
                <p className="font-bold text-sm text-gray-900 truncate">{name}</p>
                <p className="text-xs text-gray-400 truncate">{email}</p>
                {type === "kyc" && (
                  <span className={`mt-1.5 inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${s.pill}`}>
                    <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
                    {s.label}
                  </span>
                )}
              </div>
            </div>

            {/* Action */}
            <div className="shrink-0">
              <ActionButton type={type} item={item} onStartKyc={startKyc} />
            </div>
          </motion.div>
        );
      })}
    </div>
  );
}
