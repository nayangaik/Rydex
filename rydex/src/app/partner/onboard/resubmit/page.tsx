"use client";

import { motion, AnimatePresence } from "framer-motion";
import { ArrowLeft, CheckCircle2, Car, FileText, Landmark, Send, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";

export default function ResubmitPage() {
  const router = useRouter();
  const [reviewData, setReviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* ── Load current data for preview ── */
  useEffect(() => {
    axios
      .get("/api/partner/review")
      .then((res) => setReviewData(res.data.vendor))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  /* ── Submit ── */
  const handleResubmit = async () => {
    setSubmitting(true);
    setError(null);
    try {
      await axios.post("/api/partner/resubmit");
      setSubmitted(true);
      // After a short celebration delay, go back to dashboard
      setTimeout(() => router.push("/partner"), 2200);
    } catch (err: any) {
      setError(err?.response?.data?.message || "Submission failed. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  /* ── Success state ── */
  if (submitted) {
    return (
      <div className="min-h-screen bg-gray-50 grid place-items-center px-4">
        <motion.div
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="text-center space-y-4"
        >
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
            className="w-20 h-20 rounded-full bg-green-50 flex items-center justify-center mx-auto"
          >
            <CheckCircle2 size={40} className="text-green-500" />
          </motion.div>
          <h2 className="text-2xl font-bold text-gray-900">Application Submitted!</h2>
          <p className="text-gray-500 text-sm">
            Our team will review your updated documents shortly.
          </p>
          <p className="text-xs text-gray-400">Redirecting to dashboard…</p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white rounded-3xl border border-gray-200 shadow-lg p-6 sm:p-8 space-y-8"
      >
        {/* Header */}
        <div className="relative text-center">
          <button
            onClick={() => router.back()}
            className="absolute left-0 top-0 w-9 h-9 rounded-full border flex items-center justify-center hover:bg-gray-100 transition"
          >
            <ArrowLeft size={18} />
          </button>
          <p className="text-xs text-gray-500 font-medium">Final Step</p>
          <h1 className="text-2xl font-bold mt-1">Review & Resubmit</h1>
          <p className="text-sm text-gray-500 mt-2">
            Confirm your updated details below, then submit for admin review.
          </p>
        </div>

        {/* Data preview */}
        {loading ? (
          <div className="flex justify-center py-12 text-gray-400">
            <Loader2 className="animate-spin" size={24} />
          </div>
        ) : reviewData ? (
          <div className="grid lg:grid-cols-2 gap-6">
            <InfoCard title="Vehicle Details" icon={<Car size={16} />}>
              <InfoRow label="Vehicle Type" value={reviewData.vehicle?.type} />
              <InfoRow label="Reg. Number" value={reviewData.vehicle?.number} />
              <InfoRow label="Model" value={reviewData.vehicle?.model} />
            </InfoCard>

            <InfoCard title="Bank Details" icon={<Landmark size={16} />}>
              <InfoRow label="Account Holder" value={reviewData.bank?.accountHolderName} />
              <InfoRow label="IFSC Code" value={reviewData.bank?.ifsc} />
              <InfoRow label="UPI ID" value={reviewData.bank?.upi || "—"} />
            </InfoCard>

            <div className="lg:col-span-2">
              <InfoCard title="Documents" icon={<FileText size={16} />}>
                <div className="grid grid-cols-3 gap-4">
                  <DocThumb label="Aadhaar" url={reviewData.documents?.aadhaarUrl} />
                  <DocThumb label="License" url={reviewData.documents?.licenseUrl} />
                  <DocThumb label="RC" url={reviewData.documents?.rcUrl} />
                </div>
              </InfoCard>
            </div>
          </div>
        ) : (
          <p className="text-center text-gray-400 py-12">Failed to load preview.</p>
        )}

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.p
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="text-sm text-red-500 text-center"
            >
              {error}
            </motion.p>
          )}
        </AnimatePresence>

        {/* Submit button */}
        <motion.button
          whileHover={{ scale: 1.01 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleResubmit}
          disabled={submitting || loading}
          className="w-full h-14 rounded-2xl bg-black text-white font-semibold flex items-center justify-center gap-2 disabled:opacity-40 transition"
        >
          {submitting ? (
            <><Loader2 className="animate-spin" size={18} /> Submitting…</>
          ) : (
            <><Send size={16} /> Submit Application</>
          )}
        </motion.button>
      </motion.div>
    </div>
  );
}

/* ── Sub-components ── */

function InfoCard({ title, icon, children }: any) {
  return (
    <div className="rounded-2xl border border-gray-100 p-6 space-y-4 shadow-sm">
      <div className="flex items-center gap-2 font-semibold text-sm">
        {icon}
        {title}
      </div>
      {children}
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value?: string }) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold">{value || "—"}</span>
    </div>
  );
}

function DocThumb({ label, url }: { label: string; url?: string }) {
  const isImage = url?.match(/\.(jpg|jpeg|png|webp)$/i);
  return (
    <div className="rounded-xl border overflow-hidden">
      <div className="px-3 py-1.5 border-b text-xs font-semibold bg-gray-50">{label}</div>
      <div className="h-28 bg-white flex items-center justify-center">
        {url && isImage ? (
          <img src={url} className="w-full h-full object-cover" />
        ) : url ? (
          <a href={url} target="_blank" className="text-xs text-blue-600 underline">View file</a>
        ) : (
          <span className="text-xs text-gray-400">Not uploaded</span>
        )}
      </div>
    </div>
  );
}
