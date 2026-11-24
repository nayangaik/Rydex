"use client";

import { motion, AnimatePresence } from "framer-motion";
import Link from "next/link";
import { NavLinkItem } from "./Nav";

interface NavMobileMenuProps {
  menuOpen: boolean;
  setMenuOpen: (open: boolean) => void;
  navLinks: NavLinkItem[];
  pathname: string;
}

export default function NavMobileMenu({
  menuOpen,
  setMenuOpen,
  navLinks,
  pathname,
}: NavMobileMenuProps) {
  return (
    <>
      {/* Backdrop — plain div so Framer Motion gesture listeners
          don't intercept touch events before reaching menu items */}
      {menuOpen && (
        <div
          onClick={() => setMenuOpen(false)}
          className="fixed inset-0 bg-black/40 z-30 md:hidden transition-opacity duration-200"
        />
      )}

      {/* Menu Panel — only this uses Framer Motion animation */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            key="mobile-nav-menu"
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="
              fixed top-[85px] left-1/2 -translate-x-1/2
              w-[92%]
              bg-[#0B0B0B]
              rounded-2xl
              shadow-2xl
              z-40
              md:hidden
              overflow-hidden
            "
          >
            <div className="flex flex-col divide-y divide-white/10">
              {navLinks.map((item) => {
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setMenuOpen(false)}
                    className={`flex justify-between items-center px-6 py-4 transition hover:bg-white/5 ${
                      active
                        ? "text-white font-medium bg-white/5"
                        : "text-gray-300"
                    }`}
                  >
                    <span>{item.label}</span>
                    {item.badgeCount && item.badgeCount > 0 ? (
                      <span
                        className={`w-6 h-6 text-xs rounded-full flex items-center justify-center font-bold text-white ${
                          item.badgeColor === "green"
                            ? "bg-green-500"
                            : "bg-red-500"
                        }`}
                      >
                        {item.badgeCount}
                      </span>
                    ) : null}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}


