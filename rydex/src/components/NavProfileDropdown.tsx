"use client";

import { motion, AnimatePresence } from "framer-motion";
import ProfileContent from "./ProfileContent";
import { UserData } from "@/redux/userSlice";
import { RefObject } from "react";

interface NavProfileDropdownProps {
  mounted: boolean;
  userData: UserData | null;
  profileOpen: boolean;
  setProfileOpen: React.Dispatch<React.SetStateAction<boolean>>;
  setAuthOpen: (open: boolean) => void;
  handleLogout: () => void;
  profileRef: RefObject<HTMLDivElement | null>;
}

export default function NavProfileDropdown({
  mounted,
  userData,
  profileOpen,
  setProfileOpen,
  setAuthOpen,
  handleLogout,
  profileRef,
}: NavProfileDropdownProps) {
  return (
    <div className="hidden md:block relative" ref={profileRef}>
      {!mounted || !userData ? (
        <button
          suppressHydrationWarning
          onClick={() => setAuthOpen(true)}
          className="px-6 py-2.5 rounded-full border border-white/20 text-sm font-semibold hover:bg-white hover:text-black transition"
        >
          Login
        </button>
      ) : (
        <>
          <button
            onClick={() => setProfileOpen((p) => !p)}
            className="w-11 h-11 rounded-full bg-white text-black font-bold"
          >
            {userData.name?.charAt(0).toUpperCase()}
          </button>

          <AnimatePresence>
            {profileOpen && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="absolute top-14 right-0 w-[300px] bg-white text-black rounded-2xl shadow-xl border overflow-hidden"
              >
                <ProfileContent
                  userData={userData}
                  handleLogout={handleLogout}
                  onClose={() => setProfileOpen(false)}
                />
              </motion.div>
            )}
          </AnimatePresence>
        </>
      )}
    </div>
  );
}
