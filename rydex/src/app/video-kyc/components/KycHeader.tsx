import { CheckCircle, PhoneOff, XCircle } from "lucide-react";
import { useRouter } from "next/navigation";

interface KycHeaderProps {
  isAdmin: boolean;
  joined: boolean;
  onApproveClick: () => void;
  onRejectClick: () => void;
}

export function KycHeader({
  isAdmin,
  joined,
  onApproveClick,
  onRejectClick,
}: KycHeaderProps) {
  const router = useRouter();

  return (
    <header className="px-6 py-4 border-b border-white/10 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
      <div>
        <p className="font-semibold tracking-wider">RYDEX</p>
        <p className="text-xs text-gray-400">
          {isAdmin ? "Admin Verification" : "Vendor Video KYC"}
        </p>
      </div>

      {joined && (
        <div className="flex flex-wrap gap-3">
          {isAdmin && (
            <>
              <button
                onClick={onApproveClick}
                className="bg-green-600 hover:bg-green-700 px-4 py-2 rounded-full text-sm flex items-center gap-2"
              >
                <CheckCircle size={16} />
                Approve
              </button>

              <button
                onClick={onRejectClick}
                className="bg-red-600 hover:bg-red-700 px-4 py-2 rounded-full text-sm flex items-center gap-2"
              >
                <XCircle size={16} />
                Reject
              </button>
            </>
          )}

          <button
            onClick={() => router.push(isAdmin ? "/admin/dashboard" : "/partner")}
            className="bg-red-700 hover:bg-red-800 px-4 py-2 rounded-full text-sm flex items-center gap-2"
          >
            <PhoneOff size={16} />
            End Call
          </button>
        </div>
      )}
    </header>
  );
}
