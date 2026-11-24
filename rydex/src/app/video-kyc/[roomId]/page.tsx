"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { useSelector } from "react-redux";
import { RootState } from "@/redux/store";
import { KycHeader } from "../components/KycHeader";
import { KycPreview } from "../components/KycPreview";
import { KycModals } from "../components/KycModals";
import { useLocalCamera } from "../components/useLocalCamera";
import { useKycSSE } from "../components/useKycSSE";

export default function VideoKYCPage() {
  const containerRef = useRef<HTMLDivElement>(null);
  const previewRef = useRef<HTMLVideoElement>(null);
  const zpRef = useRef<any>(null);
  const joinedRef = useRef(false);

  const params = useParams();
  const router = useRouter();
  const { userData } = useSelector((state: RootState) => state.user);

  const roomId =
    typeof params?.roomId === "string"
      ? params.roomId
      : Array.isArray(params?.roomId)
      ? params.roomId[0]
      : null;

  const isAdmin = userData?.role === "admin";

  const [joined, setJoined] = useState(false);
  const [loading, setLoading] = useState(false);

  const [showApproveModal, setShowApproveModal] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [actionLoading, setActionLoading] = useState(false);

  // 1. Hook for Local Camera Preview
  const { cameraOn, micOn, toggleCamera, toggleMic } = useLocalCamera(
    joined,
    previewRef
  );

  // 2. Hook for SSE (Replaces Socket.io)
  // Vendors listen here. When admin approves/rejects, this hook automatically redirects them.
  useKycSSE(roomId, isAdmin);

  // Cleanup ZegoCloud on unmount
  useEffect(() => {
    return () => {
      zpRef.current?.destroy();
    };
  }, []);

  /* ================= START CALL ================= */

  const startCall = async () => {
    if (!roomId || !containerRef.current) return;
    if (joinedRef.current) return;

    joinedRef.current = true;
    setLoading(true);

    try {
      const tokenResponse = await fetch("/api/video-kyc/token", {
        method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ roomId }),
      });
      const credentials = await tokenResponse.json();
      if (!tokenResponse.ok) throw new Error(credentials.error || "Could not authorize this KYC room");
      const { appID, kitToken } = credentials;

      const zp = ZegoUIKitPrebuilt.create(kitToken);
      zpRef.current = zp;

      zp.joinRoom({
        container: containerRef.current,
        scenario: {
          mode: ZegoUIKitPrebuilt.OneONoneCall,
        },
        showPreJoinView: false,
      });

      setJoined(true);
    } catch (err) {
      console.error(err);
      joinedRef.current = false;
    } finally {
      setLoading(false);
    }
  };

  /* ================= ADMIN ACTIONS ================= */

  const handleApprove = async () => {
    try {
      setActionLoading(true);

      const res = await fetch("/api/admin/vendors/video-kyc/complete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "approve" }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // SSE will notify the vendor side. We just redirect the admin.
      zpRef.current?.destroy();
      router.push("/admin/dashboard");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  const handleReject = async () => {
    if (!rejectReason.trim()) {
      alert("Rejection reason required");
      return;
    }

    try {
      setActionLoading(true);

      const res = await fetch("/api/admin/vendors/video-kyc/complete", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ roomId, action: "reject", reason: rejectReason }),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.message);

      // SSE will notify the vendor side. We just redirect the admin.
      zpRef.current?.destroy();
      router.push("/admin/dashboard");
    } catch (err: any) {
      alert(err.message);
    } finally {
      setActionLoading(false);
    }
  };

  /* ================= UI ================= */

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      <KycHeader
        isAdmin={isAdmin}
        joined={joined}
        onApproveClick={() => setShowApproveModal(true)}
        onRejectClick={() => setShowRejectModal(true)}
      />

      <div className="flex-1 relative">
        {/* ZegoCloud Container */}
        <div
          ref={containerRef}
          className={`absolute inset-0 ${joined ? "block" : "hidden"}`}
        />

        {/* Local Preview before joining */}
        {!joined && (
          <KycPreview
            previewRef={previewRef}
            cameraOn={cameraOn}
            micOn={micOn}
            loading={loading}
            onToggleCamera={toggleCamera}
            onToggleMic={toggleMic}
            onJoinCall={startCall}
          />
        )}
      </div>

      {isAdmin && (
        <KycModals
          showApproveModal={showApproveModal}
          showRejectModal={showRejectModal}
          actionLoading={actionLoading}
          rejectReason={rejectReason}
          setRejectReason={setRejectReason}
          setShowApproveModal={setShowApproveModal}
          setShowRejectModal={setShowRejectModal}
          handleApprove={handleApprove}
          handleReject={handleReject}
        />
      )}
    </div>
  );
}
