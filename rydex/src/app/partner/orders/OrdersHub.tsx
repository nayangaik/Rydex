"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell,
  Zap,
  Clock,
  CheckCircle2,
  MapPin,
  Navigation,
  IndianRupee,
  Phone,
  User,
  Car,
  Loader2,
  ArrowRight,
  RotateCcw,
  Calendar,
  TrendingUp,
  Package,
  Bike,
  Truck,
} from "lucide-react";
import axios from "axios";
import { getSocket } from "@/lib/socket";
import { bindReconnectRefresh } from "@/lib/socketRecovery";
import { useRouter } from "next/navigation";

/* ─── TYPES ──────────────────────────────────────────────────── */
type BookingStatus =
  | "requested"
  | "awaiting_payment"
  | "confirmed"
  | "started"
  | "completed"
  | "cancelled"
  | "rejected"
  | "expired";

interface Booking {
  _id: string;
  pickupAddress: string;
  dropAddress: string;
  fare: number;
  status: BookingStatus;
  paymentStatus?: string;
  paymentMethod?: string;
  createdAt: string;
  userMobileNumber?: string;
  user?: { name?: string; phone?: string };
  vehicle?: {
    vehicleModel?: string;
    type?: string;
    number?: string;
  };
}

type Tab = "requests" | "active" | "history";

/* ─── HELPERS ─────────────────────────────────────────────────── */
const STATUS_PILL: Record<string, string> = {
  requested:        "bg-amber-50 text-amber-700 border border-amber-200",
  awaiting_payment: "bg-violet-50 text-violet-700 border border-violet-200",
  confirmed:        "bg-blue-50 text-blue-700 border border-blue-200",
  started:          "bg-emerald-50 text-emerald-700 border border-emerald-200",
  completed:        "bg-teal-50 text-teal-700 border border-teal-200",
  cancelled:        "bg-rose-50 text-rose-700 border border-rose-200",
  rejected:         "bg-red-50 text-red-700 border border-red-200",
  expired:          "bg-gray-100 text-gray-600 border border-gray-200",
};

const STATUS_DOT: Record<string, string> = {
  requested:        "bg-amber-400",
  awaiting_payment: "bg-violet-400",
  confirmed:        "bg-blue-400",
  started:          "bg-emerald-400",
  completed:        "bg-teal-400",
  cancelled:        "bg-rose-400",
  rejected:         "bg-red-400",
  expired:          "bg-gray-400",
};

function fmtDate(d: string) {
  return new Date(d).toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function VehicleIcon({ type }: { type?: string }) {
  const t = type?.toLowerCase();
  if (t === "bike" || t === "motorcycle") return <Bike className="w-3.5 h-3.5 text-gray-400" />;
  if (t === "truck" || t === "lorry")     return <Truck className="w-3.5 h-3.5 text-gray-400" />;
  return <Car className="w-3.5 h-3.5 text-gray-400" />;
}

/* ══════════════════════════════════════════════════════════════ */
export default function PartnerOrdersHub() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>("requests");

  /* ── Requests ── */
  const [requests, setRequests]     = useState<Booking[]>([]);
  const [reqLoading, setReqLoading] = useState(true);
  const [processingId, setProcessingId] = useState<string | null>(null);

  /* ── Active ride ── */
  const [activeRide, setActiveRide]       = useState<Booking | null>(null);
  const [activeLoading, setActiveLoading] = useState(true);

  /* ── History ── */
  const [history, setHistory]       = useState<Booking[]>([]);
  const [histLoading, setHistLoading] = useState(true);
  const [histFilter, setHistFilter] = useState("all");

  /* ── Live badge count ── */
  const [newCount, setNewCount] = useState(0);
  const notifAudio = useRef<HTMLAudioElement | null>(null);

  /* ────────── FETCH ────────── */
  const fetchRequests = useCallback(async () => {
    try {
      const res = await axios.get("/api/partner/bookings/pending");
      setRequests(res.data.bookings || []);
    } catch { setRequests([]); }
    finally   { setReqLoading(false); }
  }, []);

  const fetchActive = useCallback(async () => {
    try {
      const res = await axios.get("/api/partner/bookings/active");
      setActiveRide(res.data || null);
    } catch { setActiveRide(null); }
    finally   { setActiveLoading(false); }
  }, []);

  const fetchHistory = useCallback(async () => {
    setHistLoading(true);
    try {
      const res = await axios.get(`/api/partner/bookings?status=${histFilter}`);
      setHistory(res.data.bookings || []);
    } catch { setHistory([]); }
    finally   { setHistLoading(false); }
  }, [histFilter]);

  /* ────────── SOCKET ────────── */
  useEffect(() => {
    fetchRequests();
    fetchActive();
    const socket = getSocket();

    // Silently handle connection failures (backend offline) — UI falls back to HTTP
    socket.on("connect_error", () => {});
    const refresh = () => { void fetchRequests(); void fetchActive(); void fetchHistory(); };
    const unbindRefresh = bindReconnectRefresh(socket, refresh);

    const onNewBooking = (booking: Booking) => {
      if (!booking?._id) return;
      setRequests((prev) => prev.find((b) => b._id === booking._id) ? prev : [booking, ...prev]);
      setNewCount((c) => c + 1);
      notifAudio.current?.play().catch(() => {});
    };

    const onBookingUpdated = (data: { bookingId: string; status: BookingStatus }) => {
      setRequests((prev) => prev.filter((b) => b._id !== data.bookingId));
      fetchActive();
      void fetchHistory();
    };
    socket.on("new-booking", onNewBooking);
    socket.on("booking-updated", onBookingUpdated);

    return () => {
      socket.off("connect_error");
      unbindRefresh();
      socket.off("new-booking", onNewBooking);
      socket.off("booking-updated", onBookingUpdated);
    };
  }, [fetchRequests, fetchActive, fetchHistory]);

  useEffect(() => { fetchHistory(); }, [fetchHistory]);
  useEffect(() => { if (activeTab === "requests") setNewCount(0); }, [activeTab]);

  /* ────────── ACCEPT / REJECT ────────── */
  const handleAction = async (id: string, action: "accept" | "reject") => {
    setProcessingId(id);
    try {
      await axios.post(`/api/booking/${id}/${action}`);
      setRequests((prev) => prev.filter((b) => b._id !== id));
      if (action === "accept") { fetchActive(); setActiveTab("active"); }
    } catch { alert("Action failed. Please try again."); }
    finally   { setProcessingId(null); }
  };

  /* ────────── STATS ────────── */
  const completedCount = history.filter((b) => b.status === "completed").length;
  const totalEarnings  = history
    .filter((b) => b.status === "completed")
    .reduce((sum, b) => sum + (b.fare || 0), 0);

  /* ══════ UI ══════════════════════════════════════════════════ */
  return (
    <div className="min-h-screen bg-gray-50 pt-20">
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio ref={notifAudio} src="/notif.mp3" preload="auto" />

      {/* ── WHITE HEADER ── */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="py-8">
            {/* Live badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold mb-4">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
              LIVE & ACCEPTING ORDERS
            </div>

            <div className="flex items-start justify-between gap-4 flex-wrap">
              <div>
                <h1 className="text-3xl font-bold text-gray-900">Orders Hub</h1>
                <p className="text-gray-500 text-sm mt-1">
                  Manage ride requests, track active rides &amp; view history
                </p>
              </div>

              {/* MINI STATS */}
              <div className="flex gap-3 flex-wrap">
                <StatChip
                  icon={<Bell className="w-4 h-4 text-amber-600" />}
                  bg="bg-amber-50"
                  label="Pending"
                  value={requests.length}
                />
                <StatChip
                  icon={<Zap className="w-4 h-4 text-blue-600" />}
                  bg="bg-blue-50"
                  label="Active"
                  value={activeRide ? 1 : 0}
                />
                <StatChip
                  icon={<TrendingUp className="w-4 h-4 text-emerald-600" />}
                  bg="bg-emerald-50"
                  label="Earned"
                  value={`₹${totalEarnings.toLocaleString("en-IN")}`}
                />
              </div>
            </div>

            {/* ── TAB BAR ── */}
            <div className="flex gap-0 mt-8 border-b border-gray-200 -mb-px">
              {(
                [
                  { id: "requests", label: "Requests",    icon: <Bell className="w-4 h-4" /> },
                  { id: "active",   label: "Active Ride", icon: <Zap className="w-4 h-4" /> },
                  { id: "history",  label: "History",     icon: <Clock className="w-4 h-4" /> },
                ] as { id: Tab; label: string; icon: React.ReactNode }[]
              ).map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`relative flex items-center gap-2 px-5 py-3 text-sm font-semibold border-b-2 transition-all ${
                    activeTab === tab.id
                      ? "border-black text-gray-900"
                      : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                  }`}
                >
                  {tab.icon}
                  {tab.label}
                  {tab.id === "requests" && newCount > 0 && (
                    <span className="ml-1 bg-amber-500 text-white text-[10px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                      {newCount}
                    </span>
                  )}
                  {tab.id === "active" && activeRide && (
                    <span className="ml-1 w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                  )}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── TAB CONTENT ── */}
      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <AnimatePresence mode="wait">

          {/* ══════ REQUESTS TAB ══════ */}
          {activeTab === "requests" && (
            <motion.div
              key="requests"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              <div className="flex items-center justify-between mb-5">
                <p className="text-sm text-gray-500">
                  {requests.length} pending ride{requests.length !== 1 && "s"}
                </p>
                <button
                  onClick={() => { setReqLoading(true); fetchRequests(); }}
                  className="flex items-center gap-1.5 text-xs text-gray-500 hover:text-gray-900 transition-colors border border-gray-200 bg-white px-3 py-1.5 rounded-lg"
                >
                  <RotateCcw className="w-3.5 h-3.5" /> Refresh
                </button>
              </div>

              {reqLoading ? <CenterLoader /> : requests.length === 0 ? (
                <EmptyCard
                  icon={<Bell className="w-10 h-10 text-gray-300" />}
                  title="No Pending Requests"
                  desc="New ride requests will appear here in real time"
                />
              ) : (
                <div className="space-y-4">
                  {requests.map((booking, i) => (
                    <motion.div
                      key={booking._id}
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.04 }}
                    >
                      <RequestCard
                        booking={booking}
                        processingId={processingId}
                        onAccept={() => handleAction(booking._id, "accept")}
                        onReject={() => handleAction(booking._id, "reject")}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ══════ ACTIVE RIDE TAB ══════ */}
          {activeTab === "active" && (
            <motion.div
              key="active"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {activeLoading ? <CenterLoader /> : !activeRide ? (
                <EmptyCard
                  icon={<Car className="w-10 h-10 text-gray-300" />}
                  title="No Active Ride"
                  desc="Accept a ride request to see it here"
                  action={
                    <button
                      onClick={() => setActiveTab("requests")}
                      className="mt-4 inline-flex items-center gap-2 text-sm font-semibold text-gray-700 bg-white border border-gray-200 hover:border-gray-300 px-5 py-2.5 rounded-xl transition-all shadow-sm"
                    >
                      View Requests <ArrowRight className="w-4 h-4" />
                    </button>
                  }
                />
              ) : (
                <ActiveRideCard
                  booking={activeRide}
                  onManage={() => router.push("/partner/active-ride")}
                />
              )}
            </motion.div>
          )}

          {/* ══════ HISTORY TAB ══════ */}
          {activeTab === "history" && (
            <motion.div
              key="history"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.15 }}
            >
              {/* Filter + count */}
              <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
                <div className="flex gap-2 flex-wrap">
                  {["all", "completed", "cancelled", "rejected"].map((f) => (
                    <button
                      key={f}
                      onClick={() => setHistFilter(f)}
                      className={`px-4 py-1.5 rounded-lg text-sm font-medium capitalize transition-all border ${
                        histFilter === f
                          ? "bg-black text-white border-black"
                          : "bg-white text-gray-600 border-gray-200 hover:border-gray-300"
                      }`}
                    >
                      {f}
                    </button>
                  ))}
                </div>
                <p className="text-sm text-gray-500">{history.length} rides</p>
              </div>

              {/* Earnings banner */}
              {completedCount > 0 && histFilter === "all" && (
                <div className="mb-5 p-4 rounded-xl bg-white border border-gray-200 shadow-sm flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="bg-emerald-50 p-2 rounded-lg">
                      <CheckCircle2 className="w-5 h-5 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-gray-900">{completedCount} completed rides</p>
                      <p className="text-xs text-gray-500">Total earnings from history shown</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-0.5 text-xl font-bold text-gray-900">
                    <IndianRupee className="w-4 h-4 text-gray-500" />
                    {totalEarnings.toLocaleString("en-IN")}
                  </div>
                </div>
              )}

              {histLoading ? <CenterLoader /> : history.length === 0 ? (
                <EmptyCard
                  icon={<Package className="w-10 h-10 text-gray-300" />}
                  title="No History Yet"
                  desc="Completed and cancelled rides will appear here"
                />
              ) : (
                <div className="space-y-3">
                  {history.map((booking, i) => (
                    <motion.div
                      key={booking._id}
                      initial={{ opacity: 0, y: 6 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ delay: i * 0.03 }}
                    >
                      <HistoryCard booking={booking} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   STAT CHIP (header)
══════════════════════════════════════════════════════════════ */
function StatChip({ icon, bg, label, value }: { icon: React.ReactNode; bg: string; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center gap-3 bg-white border border-gray-200 rounded-xl px-4 py-3 shadow-sm">
      <div className={`${bg} p-2 rounded-lg`}>{icon}</div>
      <div>
        <p className="text-xs text-gray-500">{label}</p>
        <p className="text-base font-bold text-gray-900">{value}</p>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   REQUEST CARD
══════════════════════════════════════════════════════════════ */
function RequestCard({
  booking, processingId, onAccept, onReject,
}: {
  booking: Booking;
  processingId: string | null;
  onAccept: () => void;
  onReject: () => void;
}) {
  const isProcessing = processingId === booking._id;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
      {/* Customer header */}
      <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-amber-50 to-orange-50 border-b border-gray-100">
        <div className="w-10 h-10 rounded-full bg-amber-100 border border-amber-200 flex items-center justify-center shrink-0">
          <User className="w-5 h-5 text-amber-600" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-gray-900 text-sm">{booking.user?.name || "Customer"}</p>
          {(booking.userMobileNumber || booking.user?.phone) && (
            <div className="flex items-center gap-1 text-xs text-gray-500 mt-0.5">
              <Phone className="w-3 h-3" />
              {booking.userMobileNumber || booking.user?.phone}
            </div>
          )}
        </div>
        <div className="text-right shrink-0">
          <p className="text-xs text-gray-400 mb-0.5">Estimated Fare</p>
          <div className="flex items-center gap-0.5 text-xl font-bold text-gray-900">
            <IndianRupee className="w-3.5 h-3.5" />
            {booking.fare}
          </div>
        </div>
      </div>

      {/* Route */}
      <div className="p-4 space-y-3">
        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
            <MapPin className="w-3 h-3 text-green-600" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Pickup</p>
            <p className="text-sm text-gray-700 mt-0.5 leading-snug">{booking.pickupAddress}</p>
          </div>
        </div>

        <div className="ml-3 w-px h-4 border-l-2 border-dashed border-gray-200" />

        <div className="flex items-start gap-3">
          <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
            <Navigation className="w-3 h-3 text-red-500" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Drop</p>
            <p className="text-sm text-gray-700 mt-0.5 leading-snug">{booking.dropAddress}</p>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 bg-gray-50 border-t border-gray-100">
        <div className="flex items-center gap-1.5 text-xs text-gray-500">
          <Clock className="w-3.5 h-3.5" />
          {fmtDate(booking.createdAt)}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReject}
            disabled={isProcessing}
            className="px-5 py-2 rounded-xl border border-gray-200 text-sm font-medium text-gray-700 bg-white hover:bg-gray-50 transition-all disabled:opacity-50"
          >
            Decline
          </button>
          <button
            onClick={onAccept}
            disabled={isProcessing}
            className="flex items-center gap-2 px-6 py-2 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 active:scale-[0.98] transition-all disabled:opacity-50"
          >
            {isProcessing ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>Accept Ride <CheckCircle2 className="w-4 h-4" /></>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   ACTIVE RIDE CARD
══════════════════════════════════════════════════════════════ */
function ActiveRideCard({ booking, onManage }: { booking: Booking; onManage: () => void }) {
  const pill   = STATUS_PILL[booking.status]  || STATUS_PILL.confirmed;
  const dot    = STATUS_DOT[booking.status]   || "bg-gray-400";

  const statusLabel: Record<BookingStatus, string> = {
    requested:        "Awaiting Confirmation",
    awaiting_payment: "Payment Pending",
    confirmed:        "Heading to Pickup",
    started:          "Ride in Progress",
    completed:        "Ride Completed",
    cancelled:        "Ride Cancelled",
    rejected:         "Ride Rejected",
    expired:          "Request Expired",
  };

  return (
    <div className="space-y-4">
      {/* Status banner */}
      <div className="flex items-center gap-3 p-4 bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className={`w-3 h-3 rounded-full ${dot} animate-pulse shrink-0`} />
        <div className="flex-1">
          <p className="font-semibold text-gray-900 text-sm">{statusLabel[booking.status]}</p>
          <p className="text-xs text-gray-400 mt-0.5">ID: {booking._id.slice(-8).toUpperCase()}</p>
        </div>
        <span className={`px-3 py-1 rounded-full text-xs font-semibold capitalize ${pill}`}>
          {booking.status.replace("_", " ")}
        </span>
      </div>

      {/* Main card */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        {/* Customer */}
        <div className="flex items-center gap-3 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-100">
          <div className="w-12 h-12 rounded-full bg-blue-100 border border-blue-200 flex items-center justify-center shrink-0">
            <User className="w-6 h-6 text-blue-600" />
          </div>
          <div className="flex-1">
            <p className="font-semibold text-gray-900">{booking.user?.name || "Customer"}</p>
            {(booking.userMobileNumber || booking.user?.phone) && (
              <a
                href={`tel:${booking.userMobileNumber || booking.user?.phone}`}
                className="flex items-center gap-1 text-xs text-blue-600 hover:underline mt-0.5"
              >
                <Phone className="w-3 h-3" />
                {booking.userMobileNumber || booking.user?.phone}
              </a>
            )}
          </div>
          <div className="text-right shrink-0">
            <p className="text-xs text-gray-400 mb-0.5">Fare</p>
            <div className="flex items-center gap-0.5 text-2xl font-bold text-gray-900">
              <IndianRupee className="w-4 h-4" />
              {booking.fare}
            </div>
          </div>
        </div>

        {/* Route */}
        <div className="p-4 space-y-3 border-b border-gray-100">
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-green-100 flex items-center justify-center shrink-0 mt-0.5">
              <MapPin className="w-3 h-3 text-green-600" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-green-600 uppercase tracking-wider">Pickup</p>
              <p className="text-sm text-gray-700 mt-0.5 leading-snug">{booking.pickupAddress}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-6 h-6 rounded-full bg-red-100 flex items-center justify-center shrink-0 mt-0.5">
              <Navigation className="w-3 h-3 text-red-500" />
            </div>
            <div>
              <p className="text-[10px] font-semibold text-red-500 uppercase tracking-wider">Drop</p>
              <p className="text-sm text-gray-700 mt-0.5 leading-snug">{booking.dropAddress}</p>
            </div>
          </div>
        </div>

        {/* Vehicle + payment */}
        <div className="px-4 py-3 flex items-center gap-3 flex-wrap border-b border-gray-100 bg-gray-50">
          {booking.vehicle && (
            <div className="flex items-center gap-1.5 text-xs text-gray-500 bg-white border border-gray-200 px-2.5 py-1.5 rounded-lg">
              <VehicleIcon type={booking.vehicle.type} />
              {booking.vehicle.vehicleModel} {booking.vehicle.number && `• ${booking.vehicle.number}`}
            </div>
          )}
          {booking.paymentStatus && (
            <span className={`text-xs px-2.5 py-1.5 rounded-lg font-medium border ${
              booking.paymentStatus === "paid"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                : "bg-amber-50 text-amber-700 border-amber-200"
            }`}>
              Payment: {booking.paymentStatus}
            </span>
          )}
        </div>

        {/* CTA */}
        <div className="p-4">
          <button
            onClick={onManage}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-black text-white font-semibold text-sm hover:bg-gray-800 active:scale-[0.99] transition-all"
          >
            Manage Ride <ArrowRight className="w-4 h-4" />
          </button>
          <p className="text-center text-xs text-gray-400 mt-2">
            OTP verification, ride start and trip completion
          </p>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   HISTORY CARD
══════════════════════════════════════════════════════════════ */
function HistoryCard({ booking }: { booking: Booking }) {
  const pill = STATUS_PILL[booking.status] || STATUS_PILL.expired;

  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm hover:shadow-md transition-all overflow-hidden">
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 flex items-center justify-center shrink-0">
              <User className="w-4 h-4 text-gray-400" />
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-900">{booking.user?.name || "Customer"}</p>
              <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5">
                <Calendar className="w-3 h-3" />
                {fmtDate(booking.createdAt)}
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-1.5 shrink-0">
            <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-semibold capitalize ${pill}`}>
              {booking.status.replace("_", " ")}
            </span>
            <div className="flex items-center gap-0.5 font-bold text-gray-900">
              <IndianRupee className="w-3 h-3 text-gray-400" />
              {booking.fare}
            </div>
          </div>
        </div>

        {/* Route mini */}
        <div className="space-y-1.5">
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <div className="w-2 h-2 rounded-full bg-green-500 shrink-0" />
            <span className="truncate">{booking.pickupAddress}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-400">
            <div className="w-2 h-2 rounded-full bg-red-400 shrink-0" />
            <span className="truncate">{booking.dropAddress}</span>
          </div>
        </div>

        {booking.vehicle && (
          <div className="mt-2.5 flex items-center gap-1.5 text-[10px] text-gray-400">
            <VehicleIcon type={booking.vehicle.type} />
            {booking.vehicle.vehicleModel} {booking.vehicle.number && `• ${booking.vehicle.number}`}
          </div>
        )}
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════════
   SHARED SUB-COMPONENTS
══════════════════════════════════════════════════════════════ */
function CenterLoader() {
  return (
    <div className="flex justify-center py-20">
      <Loader2 className="w-7 h-7 text-gray-400 animate-spin" />
    </div>
  );
}

function EmptyCard({
  icon, title, desc, action,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-16 text-center">
      <div className="mb-3 flex justify-center">{icon}</div>
      <h3 className="text-base font-semibold text-gray-900">{title}</h3>
      <p className="text-gray-500 text-sm mt-1">{desc}</p>
      {action}
    </div>
  );
}
