"use client";

import { Check, Clock, Video, ArrowRight } from "lucide-react";
import { motion } from "framer-motion";
import {
  StatusCard,
  ActionCard,
  RejectionCard,
} from "./VendorDashboardCards";

export default function VendorDashboardStatus({
  activeStep,
  vendorStatus,
  videoKycStatus,
  roomId,
  pricing,
  userData,
  router,
  setShowPricing,
  requestKycAgain,
}: any) {
  /* ===== DOCUMENT REVIEW REJECTED ===== */
  if (activeStep === 4 && vendorStatus === "rejected") {
    return (
      <RejectionCard
        title="Documents Rejected"
        reason={userData?.vendorRejectionReason}
        actionLabel="Update Documents"
        onAction={() => router.push("/partner/onboard/documents?resubmit=true")}
      />
    );
  }

  /* ===== DOCUMENT REVIEW PENDING ===== */
  if (activeStep === 4 && vendorStatus === "pending") {
    return (
      <ActionCard
        icon={<Clock size={20} />}
        title="Documents Under Review"
        button="View Details"
        onClick={() => router.push("/partner/onboard/review")}
      />
    );
  }

  /* ===== VIDEO KYC STEP ===== */
  if (activeStep === 5) {
    if (videoKycStatus === "approved") {
      return (
        <StatusCard
          icon={<Check size={20} />}
          title="Video KYC Approved"
          desc="You can now proceed to pricing."
        />
      );
    }

    if (videoKycStatus === "rejected") {
      return (
        <RejectionCard
          title="Video KYC Rejected"
          reason={userData?.videoKycRejectionReason}
          actionLabel="Request Again"
          onAction={requestKycAgain}
        />
      );
    }

    if (videoKycStatus === "in_progress" && roomId) {
      return (
        <ActionCard
          icon={<Video />}
          title="Admin Started Video KYC"
          button="Join Call"
          onClick={() => router.push(`/video-kyc/${roomId}`)}
        />
      );
    }

    return (
      <StatusCard
        icon={<Clock size={20} />}
        title="Waiting for Admin"
        desc="Admin will initiate Video KYC shortly."
      />
    );
  }

  /* ===== PRICING REVIEW ===== */
  if (activeStep === 7 && pricing?.status === "pending") {
    return (
      <StatusCard
        icon={<Clock size={20} />}
        title="Pricing Under Review"
        desc="Admin is reviewing your pricing."
      />
    );
  }

  /* ===== PRICING REJECTED ===== */
  if (pricing?.status === "rejected") {
    return (
      <RejectionCard
        title="Pricing Rejected"
        reason={pricing.rejectionReason}
        actionLabel="Edit & Resubmit"
        onAction={() => setShowPricing(true)}
      />
    );
  }

  /* ===== LIVE ===== */
  if (activeStep === 8 && pricing?.status === "approved") {
    return (
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        className="bg-black text-white rounded-3xl p-10 shadow-2xl"
      >
        <h2 className="text-2xl font-bold">🚀 You’re Live</h2>

        <button
          onClick={() => router.push("/partner/orders")}
          className="mt-6 bg-white text-black px-6 py-3 rounded-xl font-semibold flex items-center gap-2"
        >
          Go to Orders <ArrowRight size={16} />
        </button>
      </motion.div>
    );
  }

  return null;
}
