"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Users, CheckCircle2, XCircle, Clock, Truck, Video } from "lucide-react";
import axios from "axios";

import AdminEarningsChart from "@/components/AdminEarning";
import StatusAreaChart from "@/components/AdminStatusChart";

import DashboardHeader from "./_components/DashboardHeader";
import KpiCard from "./_components/KpiCard";
import TabNav from "./_components/TabNav";
import ReviewList from "./_components/ReviewList";
import { Stats, TabType } from "./types";
import Link from "next/link";

/* ─── Page ──────────────────────────────────────────────────────────────── */

export default function AdminDashboard() {
  const [stats, setStats]               = useState<Stats | null>(null);
  const [vendorReviews, setVendorReviews]   = useState<any[]>([]);
  const [vehicleReviews, setVehicleReviews] = useState<any[]>([]);
  const [videoKycReviews, setVideoKycReviews] = useState<any[]>([]);
  const [activeTab, setActiveTab]       = useState<TabType>("kyc");
  const [loading, setLoading]           = useState(true);

  useEffect(() => { loadAll(); }, []);

  async function loadAll() {
    try {
      const [dashboardRes, kycRes] = await Promise.all([
        axios.get("/api/admin/dashboard"),
        axios.get("/api/admin/vendors/video-kyc/pending"),
      ]);
      setStats(dashboardRes.data.stats);
      setVendorReviews(dashboardRes.data.pendingVendors);
      setVehicleReviews(dashboardRes.data.pendingVehicles);
      setVideoKycReviews(kycRes.data || []);
    } catch (err) {
      console.error("Dashboard error:", err);
    } finally {
      setLoading(false);
    }
  }

  if (loading || !stats) {
    return (
      <div className="min-h-screen grid place-items-center text-gray-400">
        Loading admin dashboard...
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200">
      <DashboardHeader />

      <main className="max-w-7xl mx-auto px-6 py-12 space-y-16">
        <Link href="/admin/users" className="inline-flex rounded-xl border border-gray-200 bg-white px-4 py-3 text-sm font-medium hover:bg-gray-50">Manage user accounts</Link>
        {/* KPIs */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <KpiCard label="Total Vendors" value={stats.totalVendors} icon={<Users size={18} />}        variant="totalVendors" trend="+12%" trendDir="up"   sub="vs last month" />
          <KpiCard label="Approved"      value={stats.approved}     icon={<CheckCircle2 size={18} />} variant="approved"     trend="+8%"  trendDir="up"   sub="verified vendors" />
          <KpiCard label="Pending"       value={stats.pending}      icon={<Clock size={18} />}        variant="pending"      trend="0%"   trendDir="flat" sub="awaiting review" />
          <KpiCard label="Rejected"      value={stats.rejected}     icon={<XCircle size={18} />}      variant="rejected"     trend="-3%"  trendDir="down" sub="declined" />
        </div>

        {/* Charts */}
        <StatusAreaChart stats={stats} />
        <AdminEarningsChart />

        {/* Review queues */}
        <TabNav
          activeTab={activeTab}
          onTabChange={setActiveTab}
          kycCount={videoKycReviews.length}
          vendorCount={vendorReviews.length}
          vehicleCount={vehicleReviews.length}
        />

        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="space-y-3"
          >
            {activeTab === "kyc"     && <ReviewList data={videoKycReviews} type="kyc" />}
            {activeTab === "vendor"  && <ReviewList data={vendorReviews}   type="vendor" />}
            {activeTab === "vehicle" && <ReviewList data={vehicleReviews}  type="vehicle" />}
          </motion.div>
        </AnimatePresence>
      </main>
    </div>
  );
}
