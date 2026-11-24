"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  ArrowLeft,
  CheckCircle2,
  Clock3,
  LoaderCircle,
  Search,
  ShieldAlert,
  UserRound,
  XCircle,
  Filter,
  RefreshCw,
} from "lucide-react";

/* ─── Types ──────────────────────────────────────────────────────────────── */

type UserAccount = {
  userId: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  profile: {
    name?: string | null;
    phone?: string | null;
    city?: string | null;
    state?: string | null;
    country?: string | null;
  } | null;
  requests: { id: string; type: string; status: string; requestedAt: string }[];
};

type StatusFilter = "all" | "active" | "suspended" | "deactivation_requested" | "deletion_requested" | "deleted";

/* ─── Status helpers ─────────────────────────────────────────────────────── */

const statusStyles: Record<string, string> = {
  active: "bg-green-50 text-green-700 border-green-200",
  suspended: "bg-red-50 text-red-700 border-red-200",
  deactivation_requested: "bg-amber-50 text-amber-800 border-amber-200",
  deletion_requested: "bg-orange-50 text-orange-700 border-orange-200",
  deleted: "bg-gray-100 text-gray-500 border-gray-200",
};

function StatusPill({ status }: { status: string }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold capitalize whitespace-nowrap ${statusStyles[status] ?? "bg-gray-100 text-gray-500 border-gray-200"}`}
    >
      {status.replaceAll("_", " ")}
    </span>
  );
}

const filterOptions: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
  { value: "deactivation_requested", label: "Deactivation Req." },
  { value: "deletion_requested", label: "Deletion Req." },
  { value: "deleted", label: "Deleted" },
];

/* ─── Page ───────────────────────────────────────────────────────────────── */

export default function AdminUsersPage() {
  const [users, setUsers] = useState<UserAccount[]>([]);
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/admin/users", { cache: "no-store" });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not load accounts");
      setUsers(body);
      setError("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not load accounts");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function setStatus(userId: string, status: "active" | "suspended") {
    setBusyId(userId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/${encodeURIComponent(userId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not update account");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not update account");
    } finally {
      setBusyId("");
    }
  }

  async function decideRequest(requestId: string, decision: "approved" | "rejected") {
    setBusyId(requestId);
    setError("");
    try {
      const res = await fetch(`/api/admin/users/requests/${encodeURIComponent(requestId)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ decision }),
      });
      const body = await res.json();
      if (!res.ok) throw new Error(body.error ?? "Could not resolve account request");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not resolve account request");
    } finally {
      setBusyId("");
    }
  }

  const filtered = users.filter((u) => {
    const matchesQuery = `${u.userId} ${u.profile?.name ?? ""} ${u.profile?.phone ?? ""} ${u.profile?.city ?? ""}`.toLowerCase().includes(query.toLowerCase());
    const matchesStatus = statusFilter === "all" || u.status === statusFilter;
    return matchesQuery && matchesStatus;
  });

  /* summary counts */
  const counts = users.reduce<Record<string, number>>((acc, u) => {
    acc[u.status] = (acc[u.status] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <main className="min-h-screen bg-[#f5f6f7] px-4 py-8 text-[#171717] sm:px-8">
      <div className="mx-auto max-w-6xl">

        {/* Back */}
        <Link
          href="/admin/dashboard"
          className="mb-8 inline-flex items-center gap-2 text-sm text-gray-500 hover:text-black transition-colors"
        >
          <ArrowLeft size={16} /> Admin dashboard
        </Link>

        {/* Page header */}
        <header className="mb-7 flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="mb-2 text-xs font-semibold uppercase tracking-[.2em] text-gray-500">
              Administration
            </p>
            <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">
              User accounts
            </h1>
            <p className="mt-2 text-gray-500">
              Review account status and manage user access.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <div className="flex items-center gap-2 rounded-2xl border border-gray-200 bg-white px-4 py-3 text-sm shadow-sm">
              <UserRound size={17} />
              <span className="font-semibold">{users.length}</span>
              <span className="text-gray-500">accounts</span>
            </div>
            <button
              onClick={() => void load()}
              disabled={loading}
              className="grid h-11 w-11 place-items-center rounded-2xl border border-gray-200 bg-white hover:bg-gray-50 disabled:opacity-50 transition shadow-sm"
              title="Refresh"
            >
              <RefreshCw size={16} className={loading ? "animate-spin" : ""} />
            </button>
          </div>
        </header>

        {/* Stats row */}
        <div className="mb-5 flex flex-wrap gap-3">
          {[
            { label: "Active", key: "active", icon: <CheckCircle2 size={14} />, color: "text-green-700 bg-green-50 border-green-200" },
            { label: "Suspended", key: "suspended", icon: <XCircle size={14} />, color: "text-red-700 bg-red-50 border-red-200" },
            { label: "Deactivation req.", key: "deactivation_requested", icon: <Clock3 size={14} />, color: "text-amber-700 bg-amber-50 border-amber-200" },
            { label: "Deletion req.", key: "deletion_requested", icon: <ShieldAlert size={14} />, color: "text-orange-700 bg-orange-50 border-orange-200" },
          ].map(({ label, key, icon, color }) => (
            <div
              key={key}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${color}`}
            >
              {icon}
              {label}: {counts[key] ?? 0}
            </div>
          ))}
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              role="alert"
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="mb-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Search + filter bar */}
        <div className="mb-4 flex flex-wrap gap-3">
          <div className="flex h-11 flex-1 min-w-56 items-center gap-3 rounded-xl border border-gray-200 bg-white px-4 shadow-sm">
            <Search size={16} className="shrink-0 text-gray-400" />
            <input
              aria-label="Search accounts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by ID, phone, or city…"
              className="w-full bg-transparent text-sm outline-none"
            />
          </div>

          <div className="flex h-11 items-center gap-2 rounded-xl border border-gray-200 bg-white px-3 shadow-sm">
            <Filter size={15} className="text-gray-400 shrink-0" />
            <select
              aria-label="Filter by status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
              className="bg-transparent text-sm outline-none cursor-pointer"
            >
              {filterOptions.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-hidden rounded-3xl border border-gray-200 bg-white shadow-sm">
          {/* Header */}
          <div className="hidden grid-cols-[1.4fr_1fr_1.3fr_1fr_auto_auto] gap-4 border-b border-gray-100 bg-gray-50 px-6 py-3.5 text-xs font-semibold uppercase tracking-wider text-gray-500 md:grid">
            <span>Account ID</span>
            <span>Status</span>
            <span>Contact</span>
            <span>Created</span>
            <span>Details</span>
            <span>Action</span>
          </div>

          {loading ? (
            <div className="flex items-center gap-2 p-10 text-sm text-gray-500">
              <LoaderCircle className="animate-spin" size={17} />
              Loading accounts…
            </div>
          ) : filtered.length === 0 ? (
            <p className="p-10 text-sm text-gray-500">
              {users.length === 0 ? "No accounts found." : "No accounts match your filters."}
            </p>
          ) : (
            filtered.map((user) => {
              const isBusy = busyId === user.userId;
              const canToggle = !isBusy && user.status !== "deleted" && ["active", "suspended"].includes(user.status);
              const toggleLabel = user.status === "suspended" ? "Reactivate" : "Suspend";
              const toggleStatus: "active" | "suspended" = user.status === "suspended" ? "active" : "suspended";

              return (
                <motion.article
                  key={user.userId}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                className="grid gap-3 border-b border-gray-100 p-5 last:border-0 md:grid-cols-[1.4fr_1fr_1.3fr_1fr_auto] md:items-center md:gap-4 md:px-6"
                >
                  {/* Account ID */}
                  <div className="min-w-0">
                    <p className="text-xs text-gray-400">Profile</p>
                    <p className="truncate text-sm font-medium">{user.profile?.name || "Name not set"}</p>
                    <p className="truncate text-xs text-gray-400">{user.userId}</p>
                    <p className="mt-1 text-xs text-gray-500 md:hidden">
                      Created {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                    </p>
                  </div>

                  {/* Status */}
                  <StatusPill status={user.status} />

                  {/* Contact */}
                  <div className="text-sm text-gray-600">
                    <p>{user.profile?.phone || <span className="text-gray-400 italic">No phone</span>}</p>
                    <p className="text-xs text-gray-400 mt-0.5">
                      {[user.profile?.city, user.profile?.state, user.profile?.country]
                        .filter(Boolean)
                        .join(", ") || <span className="italic">No address</span>}
                    </p>
                  </div>

                  {/* Created date (desktop) */}
                  <p className="hidden text-sm text-gray-500 md:block">
                    {new Date(user.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>

                  {/* Toggle status */}
                  <button
                    disabled={!canToggle}
                    onClick={() => void setStatus(user.userId, toggleStatus)}
                    className={`inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-sm font-medium transition whitespace-nowrap disabled:opacity-40 ${
                      toggleStatus === "suspended"
                        ? "border-red-200 text-red-700 hover:bg-red-50"
                        : "border-green-200 text-green-700 hover:bg-green-50"
                    }`}
                  >
                    {isBusy ? (
                      <LoaderCircle size={14} className="animate-spin" />
                    ) : toggleStatus === "suspended" ? (
                      <ShieldAlert size={14} />
                    ) : (
                      <CheckCircle2 size={14} />
                    )}
                    {toggleLabel}
                  </button>

                  {user.requests?.filter((request) => request.status === "pending").map((request) => (
                    <div key={request.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3 md:col-span-5">
                      <p className="text-sm"><span className="font-medium capitalize">{request.type} request</span><span className="ml-2 text-xs text-gray-500">{new Date(request.requestedAt).toLocaleDateString("en-IN")}</span></p>
                      <div className="flex gap-2">
                        <button disabled={busyId === request.id} onClick={() => void decideRequest(request.id, "rejected")} className="rounded-lg border border-gray-200 bg-white px-3 py-2 text-xs font-medium disabled:opacity-50">Reject</button>
                        <button disabled={busyId === request.id} onClick={() => void decideRequest(request.id, "approved")} className="rounded-lg bg-black px-3 py-2 text-xs font-medium text-white disabled:opacity-50">Approve</button>
                      </div>
                    </div>
                  ))}
                </motion.article>
              );
            })
          )}
        </div>

        <p className="mt-4 text-xs text-gray-400">
          Showing up to 100 accounts. Account records are created when a user first opens profile settings.
        </p>
      </div>
    </main>
  );
}
