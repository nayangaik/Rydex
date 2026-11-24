"use client";

import { motion, AnimatePresence } from "framer-motion";
import ProfileContent from "./ProfileContent";
import { UserData } from "@/redux/userSlice";

interface NavMobileProfileSheetProps {
  profileOpen: boolean;
  userData: UserData | null;
  onClose: () => void;
  handleLogout: () => void;
}

export default function NavMobileProfileSheet({
  profileOpen,
  userData,
  onClose,
  handleLogout,
}: NavMobileProfileSheetProps) {
  return (
    <>
      {/* Backdrop — plain div with CSS transition so Framer Motion gesture
          listeners do NOT cover the whole screen and intercept touch events */}
      {profileOpen && userData && (
        <div
          onClick={onClose}
          className="fixed inset-0 bg-black/40 z-40 md:hidden transition-opacity duration-200"
        />
      )}

      {/* Sheet panel — only this uses Framer Motion (spring animation) */}
      <AnimatePresence>
        {profileOpen && userData && (
          <motion.div
            key="mobile-profile-sheet"
            initial={{ y: 400 }}
            animate={{ y: 0 }}
            exit={{ y: 400 }}
            transition={{ type: "spring", damping: 25 }}
            onClick={(e) => e.stopPropagation()}
            className="fixed inset-x-0 bottom-0 bg-white rounded-t-3xl shadow-2xl z-50 md:hidden"
          >
            <ProfileContent
              userData={userData}
              handleLogout={handleLogout}
              onClose={onClose}
              mobile
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


