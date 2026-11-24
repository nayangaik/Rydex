"use client";

import { motion } from "framer-motion";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import axios from "axios";
import { useSelector, useDispatch } from "react-redux";
import { RootState, AppDispatch } from "@/redux/store";
import { setUserData } from "@/redux/userSlice";
import PartnerEarningsChart from "./PartnerEarningChart";
import PricingModal, { PricingData } from "./PricingModal";
import VendorDashboardStatus from "./VendorDashboardStatus";
import VendorDashboardProgress from "./VendorDashboardProgress";

/* ================= TYPES ================= */

type VendorStatus = "pending" | "approved" | "rejected";

type ReviewStatus = "pending" | "approved" | "rejected";

type VideoKycStatus =
  | "not_required"
  | "pending"
  | "in_progress"
  | "approved"
  | "rejected";

type Step = {
  id: number;
  title: string;
  route?: string;
};

/* ================= STEPS ================= */

const STEPS: Step[] = [
  { id: 1, title: "Vehicle", route: "/partner/onboard/vehicle" },
  { id: 2, title: "Documents", route: "/partner/onboard/documents" },
  { id: 3, title: "Bank", route: "/partner/onboard/bank" },
  { id: 4, title: "Review", route: "/partner/onboard/review" },
  { id: 5, title: "Video KYC" },
  { id: 6, title: "Pricing" },
  { id: 7, title: "Final Review" },
  { id: 8, title: "Live" },
];

const TOTAL_STEPS = STEPS.length;

/* ================= DASHBOARD ================= */

export default function VendorDashboard({
  vendorStep,
  vendorStatus,
}: {
  vendorStep: number;
  vendorStatus: VendorStatus;
}) {
  /* ================= 1. SETUP & STATE ================= */
  const router = useRouter();
  const dispatch = useDispatch<AppDispatch>();
  const { userData } = useSelector((state: RootState) => state.user);

  const [showPricing, setShowPricing] = useState(false);
  const [pricing, setPricing] = useState<PricingData | null>(null);

  /* ================= 2. CORE CALCULATIONS ================= */
  const getActiveStep = () => {
    // vendorStep is the raw DB value (0-based index from backend)
    // step 5 = Video KYC; once KYC is approved, advance to 6
    let step = vendorStep + 1;

    // If we're at the KYC step (5) but KYC hasn't been approved yet, stay at 5
    if (step >= 5 && userData?.videoKycStatus !== "approved") {
      return 5;
    }

    return Math.min(step, TOTAL_STEPS);
  };

  const activeStep = getActiveStep();
  const progressPercent = ((activeStep - 1) / (TOTAL_STEPS - 1)) * 100;

  const videoKycStatus: VideoKycStatus = userData?.videoKycStatus || "not_required";
  const roomId = userData?.videoKycRoomId;

  /* ================= 3. GENERAL LIFECYCLE ================= */
  useEffect(() => {
    // Always re-fetch fresh user data on mount so KYC status is up to date
    axios
      .get("/api/me")
      .then((res) => {
        if (res.data) dispatch(setUserData(res.data));
      })
      .catch(() => {});
  }, [dispatch]);

  /* ================= 4. STEP 5: VIDEO KYC ================= */
  const requestKycAgain = async () => {
    try {
      await axios.patch("/api/partner/video-kyc/request");
      window.location.reload();
    } catch (err: any) {
      alert(err.response?.data?.message || "Error");
    }
  };

  /* ================= 4b. STEP 5: VIDEO KYC — SSE REAL-TIME UPDATES ================= */
  useEffect(() => {
    // Only open the SSE stream when vendor is on the KYC step and it's not yet resolved
    const shouldStream =
      activeStep === 5 &&
      videoKycStatus !== "approved" &&
      videoKycStatus !== "rejected" &&
      videoKycStatus !== "not_required";

    if (!shouldStream) return;

    // EventSource is a browser built-in — no library needed.
    // It opens ONE persistent HTTP connection to the server.
    const eventSource = new EventSource("/api/vendor/kyc-stream");

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);

        // Merge the pushed fields into existing Redux user data
        dispatch(setUserData({ ...userData, ...data }));

        // Close the stream once KYC is resolved — server will also close its end
        if (data.videoKycStatus === "approved" || data.videoKycStatus === "rejected") {
          eventSource.close();
        }
      } catch {
        // Malformed event — ignore
      }
    };

    eventSource.onerror = () => {
      // Browser will automatically retry the connection after a short delay.
      // We close here to avoid redundant connections; EventSource reopens it.
      eventSource.close();
    };

    // Cleanup: close the SSE connection when vendor leaves step 5 or component unmounts
    return () => eventSource.close();
  }, [activeStep, videoKycStatus, dispatch, userData]);

  /* ================= 5. STEP 6 & 7: PRICING ================= */
  useEffect(() => {
    axios
      .get("/api/partner/vehicle/pricing")
      .then((res) => setPricing(res.data.pricing))
      .catch(() => {});
  }, []);

  /* ================= 6. NAVIGATION ================= */
  const goToStep = (step: Step) => {
    if (step.id === 6 && vendorStatus === "approved") {
      setShowPricing(true);
      return;
    }

    if (step.route && step.id <= activeStep) {
      router.push(step.route);
    }
  };




  /* ================= UI ================= */

  return (
    <section className="min-h-screen bg-gradient-to-br from-gray-100 to-gray-200 px-4 pt-28 pb-20">
      <div className="max-w-7xl mx-auto space-y-16">

        <div>
          <h1 className="text-4xl font-bold">
            Vendor Onboarding
          </h1>
          <p className="text-gray-600 mt-3">
            Complete all steps to activate your account
          </p>
        </div>

        <VendorDashboardProgress
          steps={STEPS}
          activeStep={activeStep}
          progressPercent={progressPercent}
          goToStep={goToStep}
        />

        <VendorDashboardStatus
          activeStep={activeStep}
          vendorStatus={vendorStatus}
          videoKycStatus={videoKycStatus}
          roomId={roomId}
          pricing={pricing}
          userData={userData}
          router={router}
          setShowPricing={setShowPricing}
          requestKycAgain={requestKycAgain}
        />
        <PartnerEarningsChart/>
      </div>

      <PricingModal
        open={showPricing}
        onClose={() => setShowPricing(false)}
        pricing={pricing}
        onSaved={(updated) => setPricing(updated)}
      />
    </section>
  );
}

