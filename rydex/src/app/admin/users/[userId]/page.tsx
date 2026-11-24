"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  XCircle,
  Clock3,
  ShieldAlert,
  LoaderCircle,
  User,
  Phone,
  MapPin,
  Shield,
  Activity,
  AlertTriangle,
  Trash2,
  RotateCcw,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Profile = {
  phone?: string | null;
  photoUrl?: string | null;
  addressLine1?: string | null;
  addressLine2?: string | null;
  city?: string | null;
  state?: string | null;
  postalCode?: string | null;
  country?: string | null;
  contactDetails?: string | null;
};

type AccountRequest = {
  id: string;
  type: string;
  status: string;
  note?: string | null;
  requestedAt: string;
  resolvedAt?: string | null;
};

type AuditEvent = {
  id: string;
  action: string;
  details?: string | null;
  actorId: string;
  createdAt: string;
};

type UserDetail = {
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  profile: Profile | null;
  requests?: AccountRequest[];
};

/* ─── Status helpers ─────────────────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; cls: string; icon: React.ReactNode }> = {
  active: { label: "Active", cls: "text-green-700 bg-green-50 border-green-200", icon: <CheckCircle2 size={14} /> },
  suspended: { label: "Suspended", cls: "text-red-700 bg-red-50 border-red-200", icon: <XCircle size={14} /> },
  deactivation_requested: { label: "Deactivation Requested", cls: "text-amber-700 bg-amber-50 border-amber-200", icon: <Clock3 size={14} /> },
  deletion_requested: { label: "Deletion Requested", cls: "text-orange-700 bg-orange-50 border-orange-200", icon: <AlertTriangle size={14} /> },
  deleted: { label: "Deleted", cls: "text-gray-600 bg-gray-100 border-gray-200", icon: <Trash2 size={14} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, cls: "text-gray-600 bg-gray-100 border-gray-200", icon: <Shield size={14} /> };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${cfg.cls}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

const auditActionLabels: Record<string, { label: string; color: string }> = {
  profile_updated: { label: "Profile updated", color: "text-blue-600" },
  account_suspended: { label: "Account suspended", color: "text-red-600" },
  account_reactivated: { label: "Account reactivated", color: "text-green-600" },
  deactivation_requested: { label: "Deactivation requested", color: "text-amber-600" },
  reactivation_requested: { label: "Reactivation requested", color: "text-green-600" },
  deletion_requested: { label: "Deletion requested", color: "text-orange-600" },
};

/* ─── Info row ───────────────────────────────────────────────────────────── */

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  return (
    <div className="flex justify-between gap-4 text-sm border-b border-gray-100 pb-3 last:border-0 last:pb-0">
      <span className="text-gray-500 shrink-0">{label}</span>
      <span className="font-medium text-right break-all">{value || "—"}</span>
    </div>
  );
}

/* ─── Confirm modal ──────────────────────────────────────────────────────── */

function ConfirmModal({
  open,
  title,
  description,
  confirmLabel,
  danger,
  onCancel,
  onConfirm,
  loading,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  onCancel: () => void;
  onConfirm: () => void;
  loading: boolean;
}) {
  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.92, opacity: 0 }}
            transition={{ duration: 0.18 }}
            className="w-full max-w-sm rounded-3xl bg-white p-7 shadow-2xl"
          >
            <h2 className="text-lg font-bold">{title}</h2>
            <p className="mt-2 text-sm text-gray-500">{description}</p>
            <div className="mt-6 flex gap-3">
              <button
                onClick={onCancel}
                className="flex-1 rounded-xl border border-gray-200 py-2.5 text-sm font-medium hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={onConfirm}
                disabled={loading}
                className={`flex-1 inline-flex items-center justify-center gap-2 rounded-xl py-2.5 text-sm font-medium text-white disabled:opacity-50 ${
                  danger ? "bg-red-600 hover:bg-red-700" : "bg-black hover:bg-gray-800"
                }`}
              >
                {loading && <LoaderCircle size={15} className="animate-spin" />}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AdminUserDetailPage() {
  const { userId } = useParams() as { userId: string };
  const router = useRouter();

  const [user, setUser] = useState<UserDetail | null>(null);
  const [audit, setAudit] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [auditLoading, setAuditLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [successMsg, setSuccessMsg] = useState("");
  const [confirmAction, setConfirmAction] = useState<"suspend" | "reactivate" | null>(null);

  /* fetch user account */
  async function loadUser() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load user");
      setUser(body);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load user");
    } finally {
      setLoading(false);
    }
  }

  /* fetch audit log */
  async function loadAudit() {
    setAuditLoading(true);
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}/audit`, { cache: "no-store" });
      if (res.ok) setAudit(await res.json());
    } catch {
      /* non-critical */
    } finally {
      setAuditLoading(false);
    }
  }

  useEffect(() => {
    void loadUser();
    void loadAudit();
  }, [userId]);

  /* status update */
  async function applyStatus(status: "active" | "suspended") {
    setBusy(true);
    setError("");
    setSuccessMsg("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update account");
      setSuccessMsg(`Account ${status === "suspended" ? "suspended" : "reactivated"} successfully.`);
      await loadUser();
      await loadAudit();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update account");
    } finally {
      setBusy(false);
      setConfirmAction(null);
    }
  }

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-500">
        <div className="flex items-center gap-2">
          <LoaderCircle className="animate-spin" size={18} />
          Loading user details…
        </div>
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen grid place-items-center text-center px-4">
        <div>
          <p className="text-4xl mb-3">🔍</p>
          <p className="font-bold text-gray-800 text-lg mb-1">User not found</p>
          <p className="text-sm text-gray-400 mb-6">{error || "No account exists with this user ID."}</p>
          <button
            onClick={() => router.push("/admin/users")}
            className="px-5 py-2.5 rounded-xl bg-black text-white text-sm font-semibold hover:bg-gray-800 transition"
          >
            Back to Users
          </button>
        </div>
      </div>
    );
  }

  const isSuspended = user.status === "suspended";
  const isDeleted = user.status === "deleted";
  const canToggle = !isDeleted && ["active", "suspended"].includes(user.status);

  return (
    <>
      <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">

        {/* Sticky header */}
        <header className="sticky top-0 z-40 backdrop-blur-xl bg-white/70 border-b border-gray-200">
          <div className="max-w-7xl mx-auto px-4 h-16 flex items-center gap-4">
            <button
              onClick={() => router.back()}
              className="w-10 h-10 rounded-full border flex items-center justify-center hover:bg-gray-100 transition"
            >
              <ArrowLeft size={18} />
            </button>

            <div className="flex-1 min-w-0">
              <p className="font-semibold truncate">User: {userId}</p>
              <p className="text-xs text-gray-500">Account details &amp; administration</p>
            </div>

            <StatusBadge status={user.status} />

            <Link
              href="/admin/users"
              className="hidden sm:inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-black transition"
            >
              <ArrowLeft size={14} /> All users
            </Link>
          </div>
        </header>

        <main className="max-w-7xl mx-auto px-4 py-10 grid lg:grid-cols-3 gap-8">

          {/* ── LEFT: Account & Profile info ── */}
          <div className="lg:col-span-2 space-y-6">

            {/* Toast */}
            <AnimatePresence>
              {error && (
                <motion.p
                  role="alert"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
                >
                  {error}
                </motion.p>
              )}
              {successMsg && (
                <motion.p
                  role="status"
                  initial={{ opacity: 0, y: -6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  className="rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-700"
                >
                  ✓ {successMsg}
                </motion.p>
              )}
            </AnimatePresence>

            {/* Profile photo if present */}
            {user.profile?.photoUrl && (
              <motion.div
                whileHover={{ y: -3 }}
                className="bg-white rounded-3xl p-6 shadow-xl flex items-center gap-5"
              >
                <img
                  src={user.profile.photoUrl}
                  alt="Profile photo"
                  className="h-20 w-20 rounded-full object-cover border-2 border-gray-200"
                  onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                />
                <div>
                  <p className="font-semibold text-lg">Profile Photo</p>
                  <p className="text-sm text-gray-400 mt-1 break-all">{user.profile.photoUrl}</p>
                </div>
              </motion.div>
            )}

            {/* Account summary */}
            <motion.div whileHover={{ y: -3 }} className="bg-white rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <Shield size={18} />
                Account information
              </div>
              <div className="space-y-3">
                <InfoRow label="User ID" value={user.userId} />
                <InfoRow
                  label="Status"
                  value={user.status.replaceAll("_", " ")}
                />
                <InfoRow
                  label="Account created"
                  value={new Date(user.createdAt).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                />
                <InfoRow
                  label="Last updated"
                  value={new Date(user.updatedAt).toLocaleString("en-IN", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                />
              </div>
            </motion.div>

            {/* Contact */}
            <motion.div whileHover={{ y: -3 }} className="bg-white rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <Phone size={18} />
                Contact details
              </div>
              <div className="space-y-3">
                <InfoRow label="Phone" value={user.profile?.phone} />
                <InfoRow label="Additional contact" value={user.profile?.contactDetails} />
              </div>
            </motion.div>

            {/* Address */}
            <motion.div whileHover={{ y: -3 }} className="bg-white rounded-3xl p-6 shadow-xl space-y-4">
              <div className="flex items-center gap-2 font-semibold">
                <MapPin size={18} />
                Address
              </div>
              <div className="space-y-3">
                <InfoRow label="Address line 1" value={user.profile?.addressLine1} />
                <InfoRow label="Address line 2" value={user.profile?.addressLine2} />
                <InfoRow label="City" value={user.profile?.city} />
                <InfoRow label="State" value={user.profile?.state} />
                <InfoRow label="Postal code" value={user.profile?.postalCode} />
                <InfoRow label="Country" value={user.profile?.country} />
              </div>
            </motion.div>

            {/* Account requests */}
            {user.requests && user.requests.length > 0 && (
              <motion.div whileHover={{ y: -3 }} className="bg-white rounded-3xl p-6 shadow-xl space-y-4">
                <div className="flex items-center gap-2 font-semibold">
                  <Clock3 size={18} />
                  Account requests
                </div>
                <div className="space-y-0">
                  {user.requests.map((req, i) => (
                    <div
                      key={req.id}
                      className={`flex items-start gap-3 py-3 ${i < (user.requests?.length ?? 0) - 1 ? "border-b border-gray-100" : ""}`}
                    >
                      <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500">
                        <Clock3 size={13} />
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="text-sm font-medium capitalize">{req.type.replace("_", " ")}</p>
                          <span
                            className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${
                              req.status === "pending" ? "bg-amber-50 text-amber-700 border-amber-200"
                              : req.status === "approved" ? "bg-green-50 text-green-700 border-green-200"
                              : "bg-red-50 text-red-700 border-red-200"
                            }`}
                          >
                            {req.status}
                          </span>
                        </div>
                        <p className="text-xs text-gray-400 mt-0.5">
                          {new Date(req.requestedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                        </p>
                        {req.note && <p className="text-xs text-gray-500 mt-1 italic">"{req.note}"</p>}
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </div>

          {/* ── RIGHT: Admin actions + audit log ── */}
          <div className="space-y-6">

            {/* Admin actions card */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-white rounded-3xl p-6 shadow-xl space-y-5"
            >
              <div className="flex items-center gap-2 font-semibold">
                <ShieldAlert size={18} />
                Admin actions
              </div>

              <p className="text-sm text-gray-500">
                Changes take effect immediately and are logged in the audit trail.
              </p>

              <div className="space-y-3">
                {isSuspended ? (
                  <button
                    disabled={busy || !canToggle}
                    onClick={() => setConfirmAction("reactivate")}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl border border-green-200 py-3 text-sm font-semibold text-green-700 hover:bg-green-50 disabled:opacity-50 transition"
                  >
                    <RotateCcw size={16} /> Reactivate account
                  </button>
                ) : (
                  <button
                    disabled={busy || !canToggle}
                    onClick={() => setConfirmAction("suspend")}
                    className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-black to-gray-800 py-3 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-50 transition"
                  >
                    <ShieldAlert size={16} /> Suspend account
                  </button>
                )}

                {isDeleted && (
                  <div className="rounded-2xl border border-gray-200 bg-gray-50 p-4 text-sm text-gray-500 text-center">
                    This account has been deleted and cannot be changed.
                  </div>
                )}

                {!canToggle && !isDeleted && (
                  <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-700">
                    Account has a pending request. Resolve it before changing status.
                  </div>
                )}
              </div>
            </motion.div>

            {/* Audit log */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              className="bg-white rounded-3xl p-6 shadow-xl"
            >
              <div className="flex items-center gap-2 font-semibold mb-4">
                <Activity size={18} />
                Audit log
              </div>

              {auditLoading ? (
                <div className="flex items-center gap-2 text-sm text-gray-500 py-4">
                  <LoaderCircle className="animate-spin" size={15} />
                  Loading…
                </div>
              ) : audit.length === 0 ? (
                <p className="text-sm text-gray-400 py-2">No audit events yet.</p>
              ) : (
                <div className="relative">
                  {/* Timeline line */}
                  <div className="absolute left-3 top-2 bottom-0 w-px bg-gray-100" />

                  <div className="space-y-5 pl-8">
                    {audit.map((event) => {
                      const meta = auditActionLabels[event.action];
                      return (
                        <div key={event.id} className="relative">
                          {/* Dot */}
                          <span className="absolute -left-8 top-1 h-2.5 w-2.5 rounded-full bg-gray-300 ring-2 ring-white" />
                          <p className={`text-sm font-medium ${meta?.color ?? "text-gray-700"}`}>
                            {meta?.label ?? event.action.replace(/_/g, " ")}
                          </p>
                          {event.details && (
                            <p className="text-xs text-gray-400 mt-0.5 italic">"{event.details}"</p>
                          )}
                          <p className="text-xs text-gray-400 mt-0.5">
                            {new Date(event.createdAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                          </p>
                          <p className="text-xs text-gray-400">
                            by <span className="font-mono">{event.actorId === userId ? "user" : "admin"}</span>
                          </p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        </main>
      </div>

      {/* Confirm Modals */}
      <ConfirmModal
        open={confirmAction === "suspend"}
        title="Suspend this account?"
        description="The user will immediately lose access. This action is logged and reversible."
        confirmLabel="Suspend"
        loading={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void applyStatus("suspended")}
      />

      <ConfirmModal
        open={confirmAction === "reactivate"}
        title="Reactivate this account?"
        description="The user will regain full access to Rydex."
        confirmLabel="Reactivate"
        loading={busy}
        onCancel={() => setConfirmAction(null)}
        onConfirm={() => void applyStatus("active")}
      />
    </>
  );
}

