"use client";

import React from "react";
import Link from "next/link";
import { LogOut, Bike, Car, Truck, ChevronRight, ShieldCheck, CircleUserRound } from "lucide-react";
import { UserData } from "@/redux/userSlice";

interface ProfileContentProps {
  userData: UserData;
  handleLogout: () => void;
  mobile?: boolean;
  onClose?: () => void;
}

export default function ProfileContent({
  userData,
  handleLogout,
  mobile,
  onClose,
}: ProfileContentProps) {
  const isAdmin = userData.role === "admin";
  const isPartnerOrVendor =
    userData.role === "vendor" || userData.role === "partner";

  return (
    <div className={mobile ? "p-6 pb-10" : "p-5"}>
      <p className="font-semibold text-lg">{userData.name}</p>
      <p className="text-xs uppercase text-gray-500 mb-4">{userData.role}</p>

      <Link
        href="/profile"
        onClick={() => onClose?.()}
        className="w-full flex items-center gap-3 py-3 px-2 hover:bg-gray-100 rounded-xl transition text-left"
      >
        <CircleUserRound size={18} />
        <span>Profile & account</span>
        <ChevronRight size={16} className="ml-auto text-gray-400" />
      </Link>

      {isAdmin ? (
        <Link
          href="/admin/dashboard"
          onClick={() => onClose?.()}
          className="w-full flex items-center gap-3 py-3 px-2 hover:bg-gray-100 rounded-xl transition text-left"
        >
          <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center">
            <ShieldCheck size={14} />
          </div>
          <span>Admin Dashboard</span>
          <ChevronRight size={16} className="ml-auto text-gray-400" />
        </Link>
      ) : isPartnerOrVendor ? (
        <Link
          href="/partner"
          onClick={() => onClose?.()}
          className="w-full flex items-center gap-3 py-3 px-2 hover:bg-gray-100 rounded-xl transition text-left"
        >
          <VehicleStack />
          <span>Partner Dashboard</span>
          <ChevronRight size={16} className="ml-auto text-gray-400" />
        </Link>
      ) : (
        <Link
          href="/partner/onboard"
          onClick={() => onClose?.()}
          className="w-full flex items-center gap-3 py-3 px-2 hover:bg-gray-100 rounded-xl transition text-left"
        >
          <VehicleStack />
          <span>Become a Partner</span>
          <ChevronRight size={16} className="ml-auto text-gray-400" />
        </Link>
      )}

      <button
        onClick={() => {
          onClose?.();
          handleLogout();
        }}
        className="w-full flex items-center gap-3 py-3 px-2 hover:bg-gray-100 rounded-xl mt-2 transition text-left"
      >
        <LogOut size={16} />
        <span>Logout</span>
      </button>
    </div>
  );
}

function VehicleStack() {
  return (
    <div className="flex -space-x-2">
      <Icon>
        <Bike size={14} />
      </Icon>
      <Icon>
        <Car size={14} />
      </Icon>
      <Icon>
        <Truck size={14} />
      </Icon>
    </div>
  );
}

function Icon({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center">
      {children}
    </div>
  );
}
