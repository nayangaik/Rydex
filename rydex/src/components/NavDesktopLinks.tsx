"use client";

import Link from "next/link";
import { NavLinkItem } from "./Nav";

interface NavDesktopLinksProps {
  navLinks: NavLinkItem[];
  pathname: string;
}

export default function NavDesktopLinks({
  navLinks,
  pathname,
}: NavDesktopLinksProps) {
  return (
    <div className="hidden md:flex items-center gap-10">
      {navLinks.map((item) => {
        const active = pathname === item.href;
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`relative text-sm font-medium transition ${
              active ? "text-white" : "text-gray-400 hover:text-white"
            }`}
          >
            {item.label}
            {item.badgeCount && item.badgeCount > 0 ? (
              <span
                className={`absolute -top-2 -right-5 w-5 h-5 text-xs rounded-full flex items-center justify-center font-bold text-white ${
                  item.badgeColor === "green" ? "bg-green-500" : "bg-red-500"
                }`}
              >
                {item.badgeCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </div>
  );
}
