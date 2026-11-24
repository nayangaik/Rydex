"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ImagePlus, IndianRupee, X, Loader2 } from "lucide-react";
import axios from "axios";

/* ================= TYPES ================= */

export type PricingData = {
  baseFare?: number;
  pricePerKm?: number;
  waitingCharge?: number;
  imageUrl?: string;
  status?: "pending" | "approved" | "rejected";
  rejectionReason?: string;
};

type PricingModalProps = {
  open: boolean;
  onClose: () => void;
  pricing: PricingData | null;
  /** Called after a successful save so the parent can refresh data */
  onSaved?: (updated: PricingData) => void;
};

/* ================= COMPONENT ================= */

export default function PricingModal({
  open,
  onClose,
  pricing,
  onSaved,
}: PricingModalProps) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [baseFare, setBaseFare] = useState("");
  const [pricePerKm, setPricePerKm] = useState("");
  const [waitingCharge, setWaitingCharge] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  /* Pre-fill fields when existing pricing is loaded */
  useEffect(() => {
    if (pricing) {
      setBaseFare(pricing.baseFare?.toString() ?? "");
      setPricePerKm(pricing.pricePerKm?.toString() ?? "");
      setWaitingCharge(pricing.waitingCharge?.toString() ?? "");
      setPreview(pricing.imageUrl ?? null);
    }
  }, [pricing, open]);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImage(file);
    setPreview(URL.createObjectURL(file));
  };

  const validate = () => {
    if (!baseFare || Number(baseFare) <= 0)
      return "Base Fare must be greater than 0";
    if (!pricePerKm || Number(pricePerKm) <= 0)
      return "Price per KM must be greater than 0";
    if (!waitingCharge || Number(waitingCharge) < 0)
      return "Waiting charge cannot be negative";
    return null;
  };

  const submitPricing = async () => {
    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setLoading(true);

    try {
      const formData = new FormData();
      if (image) formData.append("image", image);
      formData.append("baseFare", baseFare);
      formData.append("pricePerKm", pricePerKm);
      formData.append("waitingCharge", waitingCharge);

      // Use PATCH for rejected resubmissions, POST for new submissions
      const isResubmit = pricing?.status === "rejected";
      const res = isResubmit
        ? await axios.patch("/api/partner/vehicle/pricing/edit", formData)
        : await axios.post("/api/partner/vehicle/pricing", formData);

      onSaved?.(res.data.pricing);
      onClose();
      window.location.reload();
    } catch (err: any) {
      setError(
        err.response?.data?.message ?? "Failed to save pricing. Try again."
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 px-4"
        >
          <motion.div
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.85, opacity: 0 }}
            className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden"
          >
            {/* Header */}
            <div className="p-6 border-b flex items-center justify-between">
              <h2 className="text-xl font-bold">Pricing &amp; Vehicle Image</h2>
              <button
                onClick={onClose}
                className="p-2 rounded-full hover:bg-gray-100 transition"
              >
                <X size={18} />
              </button>
            </div>

            {/* Body */}
            <div className="p-6 space-y-6">
              {/* Image upload */}
              <label className="relative h-44 border-2 border-dashed rounded-2xl flex items-center justify-center cursor-pointer hover:border-black transition">
                {!preview ? (
                  <div className="flex flex-col items-center gap-2 text-gray-400">
                    <ImagePlus size={32} />
                    <span className="text-sm">Upload vehicle photo</span>
                  </div>
                ) : (
                  <img
                    src={preview}
                    alt="Vehicle preview"
                    className="absolute inset-0 w-full h-full object-cover rounded-2xl"
                  />
                )}
                <input
                  hidden
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                />
              </label>

              <PriceInput
                label="Base Fare (₹)"
                value={baseFare}
                onChange={setBaseFare}
              />
              <PriceInput
                label="Price per KM (₹)"
                value={pricePerKm}
                onChange={setPricePerKm}
              />
              <PriceInput
                label="Waiting Charge / min (₹)"
                value={waitingCharge}
                onChange={setWaitingCharge}
              />

              {/* Validation / server error */}
              {error && (
                <p className="text-sm text-red-500 font-medium">{error}</p>
              )}
            </div>

            {/* Footer */}
            <div className="p-6 border-t flex gap-3">
              <button
                onClick={onClose}
                disabled={loading}
                className="flex-1 border rounded-xl py-2.5 font-medium hover:bg-gray-50 transition disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={submitPricing}
                disabled={loading}
                className="flex-1 bg-black text-white rounded-xl py-2.5 font-medium hover:bg-gray-900 transition disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {loading ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Pricing"
                )}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/* ================= PRICE INPUT ================= */

export function PriceInput({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div>
      <p className="text-sm font-semibold mb-1">{label}</p>
      <div className="flex items-center gap-2 border rounded-xl px-4 py-3 bg-white focus-within:border-black transition">
        <IndianRupee size={15} className="text-gray-400 shrink-0" />
        <input
          type="number"
          min="0"
          step="0.5"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full outline-none text-sm"
          placeholder="0.00"
        />
      </div>
    </div>
  );
}
