"use client";

import { motion } from "framer-motion";
import Image from "next/image";
import Link from "next/link";
import { useEffect, useState, useRef, useMemo } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Menu, X } from "lucide-react";
import { useDispatch, useSelector } from "react-redux";
import { signOut } from "next-auth/react";
import axios from "axios";

import { AppDispatch, RootState } from "@/redux/store";
import { setUserData } from "@/redux/userSlice";

import AuthModal from "./auth/AuthModal";
import NavDesktopLinks from "./NavDesktopLinks";
import NavProfileDropdown from "./NavProfileDropdown";
import NavMobileMenu from "./NavMobileMenu";
import NavMobileProfileSheet from "./NavMobileProfileSheet";

export interface NavLinkItem {
  label: string;
  href: string;
  badgeCount?: number;
  badgeColor?: "red" | "green";
}

const getNavLinks = (
  role?: string,
  pendingCount = 0,
  activeCount = 0
): NavLinkItem[] => {
  if (role === "vendor") {
    return [
      {
        label: "Active Ride",
        href: "/partner/active-ride",
      },
      {
        label: "Pending Requests",
        href: "/partner/pending-requests",
        badgeCount: pendingCount,
        badgeColor: "red",
      },
      {
        label: "My Bookings",
        href: "/partner/bookings",
        badgeCount: activeCount,
        badgeColor: "green",
      },
    ];
  }

  return [
    { label: "Home", href: "/" },
    { label: "Bookings", href: "/bookings" },
    { label: "Fleet", href: "/fleet" },
    { label: "FAQ", href: "/faq" },
    { label: "Contact", href: "/contact" },
  ];
};

export default function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [authOpen, setAuthOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  const [pendingCount, setPendingCount] = useState(0);
  const [activeCount, setActiveCount] = useState(0);

  const pathname = usePathname();
  const router = useRouter();
  const profileRef = useRef<HTMLDivElement>(null);

  const dispatch = useDispatch<AppDispatch>();
  const { userData } = useSelector((state: RootState) => state.user);

  /* Scroll detection & Mount */
  useEffect(() => {
    setMounted(true);
    const onScroll = () => setScrolled(window.scrollY > 30);
    window.addEventListener("scroll", onScroll);
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  /* Fetch vendor counts */
  useEffect(() => {
    if (userData?.role !== "vendor") return;

    const fetchCounts = async () => {
      try {
        const res = await axios.get("/api/partner/bookings/counts");
        setPendingCount(res.data.pending || 0);
        setActiveCount(res.data.active || 0);
      } catch {}
    };

    fetchCounts();
  }, [userData]);

  /* Close menus on route change */
  useEffect(() => {
    setMenuOpen(false);
    setProfileOpen(false);
  }, [pathname]);

  /* Desktop outside click for profile dropdown */
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const handleLogout = async () => {
    await signOut({ redirect: false });
    dispatch(setUserData(null));
    setProfileOpen(false);
    router.push("/");
  };

  /* Unified navigation links based on user role and badge counts */
  const navLinks = useMemo(
    () => getNavLinks(userData?.role, pendingCount, activeCount),
    [userData?.role, pendingCount, activeCount]
  );

  return (
    <>
      {/* ================= NAVBAR ================= */}
      <motion.nav
        initial={{ y: -60, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        className={`fixed top-3 left-1/2 -translate-x-1/2
        w-[94%] md:w-[86%]
        z-50 rounded-full bg-[#0B0B0B] text-white
        shadow-[0_15px_50px_rgba(0,0,0,0.7)]
        ${scrolled ? "py-2" : "py-3"}`}
      >
        <div className="max-w-7xl mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* LOGO */}
          <Link
            href="/home"
            onClick={() => {
              setMenuOpen(false);
              setProfileOpen(false);
            }}
            className="flex items-center"
          >
            <Image src="/logo.jpeg" alt="RYDEX" width={44} height={44} priority />
          </Link>

          {/* DESKTOP NAVIGATION LINKS */}
          <NavDesktopLinks navLinks={navLinks} pathname={pathname} />

          {/* RIGHT ACTIONS */}
          <div className="flex items-center gap-3 relative">
            {/* DESKTOP PROFILE DROPDOWN */}
            <NavProfileDropdown
              mounted={mounted}
              userData={userData}
              profileOpen={profileOpen}
              setProfileOpen={setProfileOpen}
              setAuthOpen={setAuthOpen}
              handleLogout={handleLogout}
              profileRef={profileRef}
            />

            {/* MOBILE PROFILE TRIGGER */}
            <div className="md:hidden">
              {!mounted || !userData ? (
                <button
                  suppressHydrationWarning
                  onClick={() => {
                    setAuthOpen(true);
                    setMenuOpen(false);
                  }}
                  className="px-4 py-1.5 rounded-full bg-white text-black text-sm font-semibold"
                >
                  Login
                </button>
              ) : (
                <button
                  onClick={() => {
                    setProfileOpen(true);
                    setMenuOpen(false);
                  }}
                  className="w-9 h-9 rounded-full bg-white text-black font-bold"
                >
                  {userData.name?.charAt(0).toUpperCase()}
                </button>
              )}
            </div>

            {/* MOBILE BURGER MENU BUTTON */}
            <button
              onClick={() => {
                setMenuOpen((p) => !p);
                setProfileOpen(false);
              }}
              className="md:hidden text-white p-1"
              aria-label="Toggle navigation menu"
            >
              {menuOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
      </motion.nav>

      {/* MOBILE NAVIGATION MENU */}
      <NavMobileMenu
        menuOpen={menuOpen}
        setMenuOpen={setMenuOpen}
        navLinks={navLinks}
        pathname={pathname}
      />

      {/* MOBILE PROFILE BOTTOM SHEET */}
      <NavMobileProfileSheet
        profileOpen={profileOpen}
        userData={userData}
        onClose={() => setProfileOpen(false)}
        handleLogout={handleLogout}
      />

      {/* AUTH MODAL */}
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </>
  );
}
