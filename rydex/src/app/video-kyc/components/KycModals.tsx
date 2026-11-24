import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";

interface KycModalsProps {
  showApproveModal: boolean;
  showRejectModal: boolean;
  actionLoading: boolean;
  rejectReason: string;
  setRejectReason: (reason: string) => void;
  setShowApproveModal: (show: boolean) => void;
  setShowRejectModal: (show: boolean) => void;
  handleApprove: () => void;
  handleReject: () => void;
}

export function KycModals({
  showApproveModal,
  showRejectModal,
  actionLoading,
  rejectReason,
  setRejectReason,
  setShowApproveModal,
  setShowRejectModal,
  handleApprove,
  handleReject,
}: KycModalsProps) {
  return (
    <>
      {/* APPROVE MODAL */}
      <AnimatePresence>
        {showApproveModal && (
          <Modal onClose={() => setShowApproveModal(false)}>
            <h2 className="text-lg font-semibold mb-4">Confirm Approval</h2>
            <div className="flex gap-4">
              <button
                onClick={() => setShowApproveModal(false)}
                className="flex-1 border rounded-xl py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleApprove}
                className="flex-1 bg-green-600 rounded-xl py-2"
              >
                {actionLoading ? "Processing..." : "Approve"}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>

      {/* REJECT MODAL */}
      <AnimatePresence>
        {showRejectModal && (
          <Modal onClose={() => setShowRejectModal(false)}>
            <h2 className="text-lg font-semibold mb-4">Reject Vendor</h2>
            <textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              className="w-full bg-white/10 border border-white/20 rounded-xl p-3 mb-4 text-sm"
              placeholder="Why is this rejected?"
            />
            <div className="flex gap-4">
              <button
                onClick={() => setShowRejectModal(false)}
                className="flex-1 border rounded-xl py-2"
              >
                Cancel
              </button>
              <button
                onClick={handleReject}
                className="flex-1 bg-red-600 rounded-xl py-2"
              >
                {actionLoading ? "Processing..." : "Reject"}
              </button>
            </div>
          </Modal>
        )}
      </AnimatePresence>
    </>
  );
}

function Modal({
  children,
  onClose,
}: {
  children: React.ReactNode;
  onClose: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4"
    >
      <motion.div
        initial={{ scale: 0.9 }}
        animate={{ scale: 1 }}
        className="relative bg-[#111] w-full max-w-md rounded-2xl p-6 shadow-2xl"
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-gray-400"
        >
          <X size={16} />
        </button>
        {children}
      </motion.div>
    </motion.div>
  );
}
