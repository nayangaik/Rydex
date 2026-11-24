"use client";

import { ChangeEvent, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  Check,
  CircleUserRound,
  Clock3,
  LoaderCircle,
  Shield,
  Trash2,
  User,
  Phone,
  MapPin,
  Info,
  Camera,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Sparkles,
  Upload,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type Profile = {
  name?: string | null;
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

type Snapshot = {
  profile: Profile;
  account: {
    status: string;
    createdAt: string;
    updatedAt: string;
    requests: AccountRequest[];
  };
};

/* ─── Field groups ───────────────────────────────────────────────────────── */

const profileFieldGroups = [
  {
    section: "Contact",
    icon: <Phone size={16} />,
    fields: [
      { key: "name" as keyof Profile, label: "Name", placeholder: "Your name", span: 2 },
      { key: "phone" as keyof Profile, label: "Phone number", placeholder: "+91 98765 43210", span: 1 },
    ],
  },
  {
    section: "Address",
    icon: <MapPin size={16} />,
    fields: [
      { key: "addressLine1" as keyof Profile, label: "Address line 1", placeholder: "House, street, area", span: 2 },
      { key: "addressLine2" as keyof Profile, label: "Address line 2 (optional)", placeholder: "Apartment or landmark", span: 2 },
      { key: "city" as keyof Profile, label: "City", placeholder: "City", span: 1 },
      { key: "state" as keyof Profile, label: "State", placeholder: "State", span: 1 },
      { key: "postalCode" as keyof Profile, label: "Postal code", placeholder: "400001", span: 1 },
      { key: "country" as keyof Profile, label: "Country", placeholder: "India", span: 1 },
    ],
  },
  {
    section: "Additional",
    icon: <Info size={16} />,
    fields: [
      {
        key: "contactDetails" as keyof Profile,
        label: "Additional contact details",
        placeholder: "Preferred contact method or alternate contact",
        span: 2,
      },
    ],
  },
];

const completionKeys: (keyof Profile)[] = [
  "name",
  "phone",
  "photoUrl",
  "addressLine1",
  "city",
  "state",
  "postalCode",
  "country",
];

/* ─── Status helpers ─────────────────────────────────────────────────────── */

const statusConfig: Record<string, { label: string; color: string; bg: string; icon: React.ReactNode }> = {
  active: { label: "Active", color: "text-green-700", bg: "bg-green-50 border-green-200", icon: <CheckCircle2 size={14} /> },
  suspended: { label: "Suspended", color: "text-red-700", bg: "bg-red-50 border-red-200", icon: <XCircle size={14} /> },
  deactivation_requested: { label: "Deactivation Requested", color: "text-amber-700", bg: "bg-amber-50 border-amber-200", icon: <Clock3 size={14} /> },
  deletion_requested: { label: "Deletion Requested", color: "text-orange-700", bg: "bg-orange-50 border-orange-200", icon: <AlertTriangle size={14} /> },
  deleted: { label: "Deleted", color: "text-gray-700", bg: "bg-gray-50 border-gray-200", icon: <Trash2 size={14} /> },
};

function StatusBadge({ status }: { status: string }) {
  const cfg = statusConfig[status] ?? { label: status, color: "text-gray-700", bg: "bg-gray-50 border-gray-200", icon: <Shield size={14} /> };
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold capitalize ${cfg.color} ${cfg.bg}`}>
      {cfg.icon}
      {cfg.label}
    </span>
  );
}

function RequestBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending: "bg-amber-50 text-amber-700 border-amber-200",
    approved: "bg-green-50 text-green-700 border-green-200",
    rejected: "bg-red-50 text-red-700 border-red-200",
    cancelled: "bg-gray-100 text-gray-500 border-gray-200",
  };
  return (
    <span className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold capitalize ${map[status] ?? "bg-gray-100 text-gray-500"}`}>
      {status}
    </span>
  );
}

/* ─── Confirm Dialog ─────────────────────────────────────────────────────── */

function ConfirmDialog({
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
                {loading ? <LoaderCircle size={15} className="animate-spin" /> : null}
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

export default function ProfilePage() {
  const [data, setData] = useState<Snapshot | null>(null);
  const [form, setForm] = useState<Profile>({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoLoadFailed, setPhotoLoadFailed] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  /* dialogs */
  const [dialog, setDialog] = useState<{
    type: "deactivation" | "reactivation" | "deletion" | null;
    open: boolean;
  }>({ type: null, open: false });

  /* completion */
  const completion = useMemo(() => {
    const filled = completionKeys.filter((k) => form[k]?.trim()).length;
    return Math.round((filled / completionKeys.length) * 100);
  }, [form]);

  /* data fetching */
  async function refresh() {
    setLoading(true);
    try {
      const res = await fetch("/api/users/me", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load your profile");
      setData(body);
      setForm(body.profile ?? {});
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load your profile");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => { void refresh(); }, []);

  /* generic submit */
  async function submit(path: string, method: string, body: object, success: string) {
    setBusy(true);
    setMessage("");
    setError("");
    try {
      const res = await fetch(path, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Request failed");
      setMessage(success);
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Request failed");
    } finally {
      setBusy(false);
      setDialog({ type: null, open: false });
    }
  }

  const saveProfile = () =>
    submit("/api/users/me", "PUT", form, "Profile saved successfully.");

  async function uploadProfilePhoto(event: ChangeEvent<HTMLInputElement>) {
    const photo = event.target.files?.[0];
    event.target.value = "";
    if (!photo) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(photo.type)) {
      setError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (photo.size > 5 * 1024 * 1024) {
      setError("Profile photos must be 5 MB or smaller.");
      return;
    }

    setPhotoUploading(true);
    setError("");
    setMessage("");
    try {
      const formData = new FormData();
      formData.append("photo", photo);
      const response = await fetch("/api/users/me/photo", { method: "POST", body: formData });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Photo upload failed");
      setForm((current) => ({ ...current, photoUrl: result.photoUrl }));
      setData((current) => current ? { ...current, profile: { ...current.profile, photoUrl: result.photoUrl } } : current);
      setPhotoLoadFailed(false);
      setMessage("Profile photo updated.");
    } catch (error) {
      setError(error instanceof Error ? error.message : "Photo upload failed");
    } finally {
      setPhotoUploading(false);
    }
  }

  const submitRequest = (type: "deactivation" | "reactivation" | "deletion") =>
    submit(
      "/api/users/me/requests",
      "POST",
      { type },
      `${type.charAt(0).toUpperCase() + type.slice(1)} request submitted.`
    );

  const accountStatus = data?.account.status ?? "";
  const hasPendingRequest = data?.account.requests.some((r) => r.status === "pending");
  const displayName = form.name?.trim() || "Your profile";

  return (
    <>
      <main className="min-h-screen bg-[#f5f6f7] px-4 py-8 text-[#171717] sm:px-8">
        <div className="mx-auto max-w-5xl">

          {/* Back link */}
          <Link
            href="/"
            className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
          >
            <ArrowLeft size={16} /> Back to Rydex
          </Link>

          {/* Profile overview */}
          <header className="relative mb-8 overflow-hidden rounded-[2rem] bg-[#111] px-6 py-7 text-white shadow-xl shadow-black/10 sm:px-9 sm:py-9">
            <div aria-hidden="true" className="pointer-events-none absolute -right-20 -top-32 h-80 w-80 rounded-full border-[44px] border-white/[.04]" />
            <div aria-hidden="true" className="pointer-events-none absolute -bottom-36 right-36 h-64 w-64 rounded-full bg-amber-400/10 blur-3xl" />
            <div className="relative flex flex-wrap items-center justify-between gap-7">
              <div className="flex min-w-0 items-center gap-5 sm:gap-6">
                <div className="relative grid h-[76px] w-[76px] shrink-0 place-items-center rounded-[26px] bg-gradient-to-br from-amber-300 to-orange-500 p-[3px] shadow-lg shadow-amber-500/20 sm:h-24 sm:w-24 sm:rounded-[30px]">
                  <div className="grid h-full w-full place-items-center overflow-hidden rounded-[23px] bg-[#222] sm:rounded-[27px]">
                    {form.photoUrl && !photoLoadFailed ? <img src={form.photoUrl} alt={`${displayName} profile`} className="h-full w-full object-cover" onError={() => setPhotoLoadFailed(true)} /> : <CircleUserRound size={42} strokeWidth={1.35} className="text-white/90 sm:h-12 sm:w-12" />}
                  </div>
                  <span className="absolute -bottom-1 -right-1 grid h-7 w-7 place-items-center rounded-full border-[3px] border-[#111] bg-emerald-400 text-[#111]" title="Profile"><Check size={13} strokeWidth={3} /></span>
                </div>
                <div className="min-w-0">
                  <p className="mb-2 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[.22em] text-amber-300"><Sparkles size={13} /> Account center</p>
                  <h1 className="truncate text-2xl font-semibold tracking-tight sm:text-4xl">{displayName}</h1>
                  <p className="mt-1.5 text-sm text-white/55">Your Rydex profile and account settings</p>
                  <div className="mt-3"><StatusBadge status={accountStatus} /></div>
                  <label className="mt-3 inline-flex h-9 cursor-pointer items-center gap-2 rounded-xl border border-white/15 bg-white/[.08] px-3 text-xs font-medium text-white/85 transition hover:bg-white/[.14]">
                    {photoUploading ? <LoaderCircle size={14} className="animate-spin" /> : <Upload size={14} />}
                    {photoUploading ? "Uploading photo…" : "Upload profile photo"}
                    <input type="file" accept="image/jpeg,image/png,image/webp" onChange={uploadProfilePhoto} disabled={photoUploading} className="sr-only" />
                  </label>
                </div>
              </div>
              <div className="w-full rounded-2xl border border-white/10 bg-white/[.06] p-4 backdrop-blur sm:w-64 sm:p-5">
                <div className="flex items-center justify-between text-sm"><span className="font-medium text-white/80">Profile strength</span><span className="font-semibold tabular-nums text-amber-300">{completion}%</span></div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                  <motion.div className={`h-full rounded-full ${completion === 100 ? "bg-emerald-400" : "bg-gradient-to-r from-amber-300 to-orange-400"}`} initial={{ width: 0 }} animate={{ width: `${completion}%` }} transition={{ duration: 0.65, ease: "easeOut" }} />
                </div>
                <p className="mt-2 text-xs text-white/45">{completion === 100 ? "Everything looks good." : "Add a few details to complete your profile."}</p>
              </div>
            </div>
          </header>

          {/* Toast messages */}
          <AnimatePresence>
            {error && (
              <motion.p
                role="alert"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
              >
                {error}
              </motion.p>
            )}
            {message && (
              <motion.p
                role="status"
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mb-4 rounded-xl border border-green-200 bg-green-50 p-3 text-sm text-green-800"
              >
                ✓ {message}
              </motion.p>
            )}
          </AnimatePresence>

          {loading ? (
            <div className="flex items-center gap-2 py-16 text-gray-500">
              <LoaderCircle className="animate-spin" size={18} />
              Loading account…
            </div>
          ) : (
            <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">

              {/* ─── LEFT: Profile form ─── */}
              <div className="space-y-5">

                {/* Profile fields grouped */}
                {profileFieldGroups.map((group) => (
                  <section
                    key={group.section}
                    className="rounded-3xl border border-gray-200 bg-white p-6 sm:p-8"
                  >
                    <div className="mb-5 flex items-center gap-2 font-semibold text-sm">
                      <span className="grid h-7 w-7 place-items-center rounded-lg bg-gray-100 text-gray-600">
                        {group.icon}
                      </span>
                      {group.section}
                    </div>

                    <div className="grid gap-4 sm:grid-cols-2">
                      {group.fields.map(({ key, label, placeholder, span }) => (
                        <label
                          key={key}
                          className={`grid gap-1.5 text-sm font-medium ${span === 2 ? "sm:col-span-2" : ""}`}
                        >
                          {label}
                          <input
                            value={form[key] ?? ""}
                            onChange={(e) =>
                              setForm((cur) => ({ ...cur, [key]: e.target.value }))
                            }
                            placeholder={placeholder}
                            className="h-11 rounded-xl border border-gray-200 px-3 font-normal text-sm outline-none transition focus:border-black focus:ring-2 focus:ring-black/5"
                          />
                        </label>
                      ))}
                    </div>
                  </section>
                ))}

                {/* Save button */}
                <div className="flex justify-end">
                  <button
                    disabled={busy}
                    onClick={saveProfile}
                    className="inline-flex h-11 items-center gap-2 rounded-xl bg-black px-6 text-sm font-medium text-white hover:bg-gray-800 disabled:opacity-50 transition"
                  >
                    {busy ? (
                      <LoaderCircle size={16} className="animate-spin" />
                    ) : (
                      <Check size={16} />
                    )}
                    Save profile
                  </button>
                </div>
              </div>

              {/* ─── RIGHT: Account sidebar ─── */}
              <aside className="space-y-5">

                {/* Account status */}
                <section className="rounded-3xl border border-gray-200 bg-white p-6">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gray-100">
                        <Shield size={18} />
                      </span>
                      <div>
                        <h2 className="font-semibold">Account status</h2>
                        <p className="text-xs text-gray-400 mt-0.5">Your current standing</p>
                      </div>
                    </div>
                    <StatusBadge status={accountStatus} />
                  </div>

                  <dl className="mt-5 grid gap-3 border-t border-gray-100 pt-4 text-sm">
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Created</dt>
                      <dd className="font-medium">
                        {data?.account.createdAt
                          ? new Date(data.account.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </dd>
                    </div>
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Last updated</dt>
                      <dd className="font-medium">
                        {data?.account.updatedAt
                          ? new Date(data.account.updatedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
                          : "—"}
                      </dd>
                    </div>
                  </dl>

                  {/* Account actions */}
                  <div className="mt-5 grid gap-2 border-t border-gray-100 pt-4">
                    {accountStatus === "suspended" ? (
                      <button
                        disabled={busy || hasPendingRequest}
                        onClick={() => setDialog({ type: "reactivation", open: true })}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
                      >
                        <RotateCcw size={15} /> Request reactivation
                      </button>
                    ) : (
                      <button
                        disabled={busy || accountStatus !== "active" || !!hasPendingRequest}
                        onClick={() => setDialog({ type: "deactivation", open: true })}
                        className="inline-flex items-center gap-2 rounded-xl border border-gray-200 px-4 py-3 text-sm font-medium hover:bg-gray-50 disabled:opacity-50 transition"
                      >
                        <User size={15} /> Request deactivation
                      </button>
                    )}

                    <button
                      disabled={busy || accountStatus === "deleted" || !!hasPendingRequest}
                      onClick={() => setDialog({ type: "deletion", open: true })}
                      className="inline-flex items-center justify-center gap-2 rounded-xl border border-red-200 px-4 py-3 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50 transition"
                    >
                      <Trash2 size={15} /> Request account deletion
                    </button>

                    {hasPendingRequest && (
                      <p className="text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-xl px-3 py-2">
                        You have a pending request. Resolve it before submitting another.
                      </p>
                    )}
                  </div>
                </section>

                {/* Account requests history */}
                <section className="rounded-3xl border border-gray-200 bg-white p-6">
                  <h2 className="font-semibold">Request history</h2>
                  <p className="mt-0.5 text-xs text-gray-400">Your account management requests.</p>

                  <div className="mt-4 space-y-0">
                    {data?.account.requests.length ? (
                      data.account.requests.map((req, i) => (
                        <div
                          key={req.id}
                          className={`flex items-start gap-3 py-3 ${i < data.account.requests.length - 1 ? "border-b border-gray-100" : ""}`}
                        >
                          <span className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full bg-gray-100 text-gray-500">
                            <Clock3 size={13} />
                          </span>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              <p className="text-sm font-medium capitalize">{req.type.replace("_", " ")}</p>
                              <RequestBadge status={req.status} />
                            </div>
                            <p className="mt-1 text-xs text-gray-400">
                              Submitted {new Date(req.requestedAt).toLocaleString("en-IN", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit" })}
                            </p>
                            {req.resolvedAt && (
                              <p className="text-xs text-gray-400">
                                Resolved {new Date(req.resolvedAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                              </p>
                            )}
                          </div>
                        </div>
                      ))
                    ) : (
                      <p className="text-sm text-gray-500 py-3">No requests yet.</p>
                    )}
                  </div>
                </section>

                {/* Profile completion guide */}
                {completion < 100 && (
                  <section className="rounded-3xl border border-amber-200 bg-amber-50 p-5">
                    <div className="flex items-center gap-2 text-sm font-semibold text-amber-800">
                      <Camera size={15} />
                      Complete your profile
                    </div>
                    <ul className="mt-3 space-y-1.5 text-xs text-amber-700">
                      {completionKeys
                        .filter((k) => !form[k]?.trim())
                        .map((k) => (
                          <li key={k} className="flex items-center gap-1.5">
                            <span className="h-1 w-1 rounded-full bg-amber-500" />
                            {k === "photoUrl" ? "Profile photo" : k.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}
                          </li>
                        ))}
                    </ul>
                  </section>
                )}
              </aside>
            </div>
          )}
        </div>
      </main>

      {/* Confirm Dialogs */}
      <ConfirmDialog
        open={dialog.open && dialog.type === "deactivation"}
        title="Request account deactivation?"
        description="Your account will be deactivated after admin review. You can request reactivation at any time."
        confirmLabel="Submit request"
        loading={busy}
        onCancel={() => setDialog({ type: null, open: false })}
        onConfirm={() => submitRequest("deactivation")}
      />

      <ConfirmDialog
        open={dialog.open && dialog.type === "reactivation"}
        title="Request account reactivation?"
        description="An administrator will review and reactivate your suspended account."
        confirmLabel="Submit request"
        loading={busy}
        onCancel={() => setDialog({ type: null, open: false })}
        onConfirm={() => submitRequest("reactivation")}
      />

      <ConfirmDialog
        open={dialog.open && dialog.type === "deletion"}
        title="Request account deletion?"
        description="This is permanent and irreversible. All your data will be removed after administrator approval."
        confirmLabel="Request deletion"
        danger
        loading={busy}
        onCancel={() => setDialog({ type: null, open: false })}
        onConfirm={() => submitRequest("deletion")}
      />
    </>
  );
}
