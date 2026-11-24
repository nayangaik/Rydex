"use client";

import { motion } from "framer-motion";
import { ArrowLeft, Car, FileText, Landmark, Clock, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";

export default function PartnerReviewPage() {
  const router = useRouter();
  const [reviewData, setReviewData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    axios
      .get("/api/partner/review")
      .then((res) => {
        setReviewData(res.data.vendor);
        setLoading(false);
      })
      .catch(() => {
        setLoading(false);
      });
  }, []);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-20">
      <motion.div
        initial={{ opacity: 0, y: 28 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-4xl bg-white rounded-3xl border border-gray-200 shadow-lg p-6 sm:p-8"
      >
        {/* ================= HEADER ================= */}
        <div className="relative text-center mb-8">
          <button
            onClick={() => router.push("/partner")}
            className="absolute left-0 top-0 w-9 h-9 rounded-full border flex items-center justify-center hover:bg-gray-100 transition"
          >
            <ArrowLeft size={18} />
          </button>

          <p className="text-xs text-gray-500 font-medium">Step 4</p>
          <h1 className="text-2xl font-bold mt-1">Application Review</h1>
          <p className="text-sm text-gray-500 mt-2">
            Review your submitted details.
          </p>
        </div>

        {loading ? (
          <div className="flex justify-center py-20 text-gray-500">
            Loading review details...
          </div>
        ) : reviewData ? (
          <div className="space-y-6">
            <div className="flex items-center gap-3 bg-blue-50 text-blue-700 p-4 rounded-xl border border-blue-100">
              <Clock size={20} />
              <p className="text-sm font-medium">
                Your application is currently under review by the admin team.
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6 mt-8">
              <AnimatedCard title="Vehicle Details" icon={<Car size={18} />}>
                <InfoRow label="Vehicle Type" value={reviewData.vehicle?.type} />
                <InfoRow
                  label="Registration Number"
                  value={reviewData.vehicle?.number}
                />
                <InfoRow label="Model" value={reviewData.vehicle?.model} />
              </AnimatedCard>

              <AnimatedCard title="Bank Details" icon={<Landmark size={18} />}>
                <InfoRow
                  label="Account Holder"
                  value={reviewData.bank?.accountHolderName}
                />
                <InfoRow label="IFSC Code" value={reviewData.bank?.ifsc} />
                <InfoRow label="UPI ID" value={reviewData.bank?.upi || "—"} />
              </AnimatedCard>

              <div className="lg:col-span-2">
                <AnimatedCard title="Documents" icon={<FileText size={18} />}>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
                    <DocPreview
                      label="Aadhaar"
                      url={reviewData.documents?.aadhaarUrl}
                    />
                    <DocPreview
                      label="License"
                      url={reviewData.documents?.licenseUrl}
                    />
                    <DocPreview label="RC" url={reviewData.documents?.rcUrl} />
                  </div>
                </AnimatedCard>
              </div>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.97 }}
              onClick={() => router.push("/partner")}
              className="mt-8 w-full h-14 rounded-2xl bg-black text-white font-semibold transition"
            >
              Back to Dashboard
            </motion.button>
          </div>
        ) : (
          <div className="text-center py-20 text-gray-500">
            Failed to load data.
          </div>
        )}
      </motion.div>
    </div>
  );
}

function AnimatedCard({ title, icon, children }: any) {
  return (
    <motion.div
      whileHover={{ y: -4 }}
      className="bg-white rounded-[24px] p-6 sm:p-8 shadow-sm border border-gray-100 space-y-6"
    >
      <div className="flex items-center gap-2 font-semibold">
        {icon}
        {title}
      </div>
      {children}
    </motion.div>
  );
}

function DocPreview({ label, url }: any) {
  const isImage = url?.match(/\.(jpg|jpeg|png|webp)$/i);
  const isPdf = url?.endsWith(".pdf");

  return (
    <div className="bg-gray-50 rounded-2xl border overflow-hidden shadow-sm">
      <div className="px-4 py-2 border-b text-sm font-semibold">{label}</div>

      <div className="h-40 sm:h-52 flex items-center justify-center bg-white">
        {!url && <span className="text-xs text-gray-400">Not uploaded</span>}

        {isImage && <img src={url} className="w-full h-full object-cover" />}

        {isPdf && <iframe src={url} className="w-full h-full" />}
      </div>

      {url && (
        <a
          href={url}
          target="_blank"
          className="block text-center text-xs py-2 font-medium hover:bg-gray-100"
        >
          Open full document
        </a>
      )}
    </div>
  );
}

function InfoRow({ label, value }: any) {
  return (
    <div className="flex justify-between text-sm">
      <span className="text-gray-500">{label}</span>
      <span className="font-semibold text-right">{value || "—"}</span>
    </div>
  );
}
