import Link from "next/link";
import { ShieldCheck, Users } from "lucide-react";

export default function DashboardHeader() {
  return (
    <header className="sticky top-0 bg-white/80 backdrop-blur-lg border-b z-40">
      <div className="max-w-7xl mx-auto h-16 px-6 flex items-center justify-between">
        <Link href="/home" className="flex items-center gap-3 hover:opacity-80 transition">
          <div className="w-10 h-10 rounded-2xl bg-black text-white flex items-center justify-center font-bold">
            R
          </div>
          <span className="font-bold text-lg tracking-wide">RYDEX ADMIN</span>
        </Link>

        <nav className="flex items-center gap-4">
          <Link
            href="/admin/users"
            className="hidden sm:inline-flex items-center gap-2 text-sm font-medium text-gray-600 hover:text-black transition rounded-full px-4 py-2 hover:bg-gray-100"
          >
            <Users size={15} />
            User accounts
          </Link>

          <div className="flex items-center gap-2 text-xs px-3 py-1.5 rounded-full bg-green-100 text-green-700">
            <ShieldCheck size={14} />
            Secure Mode
          </div>
        </nav>
      </div>
    </header>
  );
}
