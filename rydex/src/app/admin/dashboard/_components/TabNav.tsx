import { motion } from "framer-motion";
import { Video, Users, Truck } from "lucide-react";
import { TabType } from "../types";

interface TabButtonProps {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
  icon: React.ReactNode;
  count: number;
}

function TabButton({ active, onClick, children, icon, count }: TabButtonProps) {
  return (
    <motion.button
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
      className={`relative flex items-center gap-2 px-5 py-2.5 rounded-2xl text-sm font-semibold transition-all duration-200 select-none
        ${active
          ? "bg-neutral-950 text-white shadow-lg shadow-black/20"
          : "text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        }`}
    >
      <span className={`flex items-center ${active ? "text-white" : "text-gray-400"}`}>
        {icon}
      </span>

      <span className="hidden sm:inline">{children}</span>

      <span className={`min-w-[22px] h-5 px-1.5 text-[11px] font-bold rounded-full flex items-center justify-center transition-all
        ${active
          ? "bg-white text-black"
          : count > 0
          ? "bg-red-500 text-white"
          : "bg-gray-200 text-gray-400"
        }`}
      >
        {count}
      </span>
    </motion.button>
  );
}

interface TabNavProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  kycCount: number;
  vendorCount: number;
  vehicleCount: number;
}

export default function TabNav({
  activeTab,
  onTabChange,
  kycCount,
  vendorCount,
  vehicleCount,
}: TabNavProps) {
  return (
    <div className="bg-white rounded-2xl p-2 shadow-lg border border-gray-100 flex flex-wrap gap-2">
      <TabButton
        active={activeTab === "kyc"}
        count={kycCount}
        onClick={() => onTabChange("kyc")}
        icon={<Video size={15} />}
      >
        Video KYC
      </TabButton>

      <TabButton
        active={activeTab === "vendor"}
        count={vendorCount}
        onClick={() => onTabChange("vendor")}
        icon={<Users size={15} />}
      >
        Vendor Reviews
      </TabButton>

      <TabButton
        active={activeTab === "vehicle"}
        count={vehicleCount}
        onClick={() => onTabChange("vehicle")}
        icon={<Truck size={15} />}
      >
        Pricing &amp; Images
      </TabButton>
    </div>
  );
}
