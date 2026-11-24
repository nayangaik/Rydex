import { NextResponse } from "next/server";
import prisma from "@/lib/db";

/* ─────────────────────────────────────────────────────────────
   GET /api/admin/earnings

   Returns platform-wide daily earnings for the last N days.
   Query params:
     ?days=7   (default 7, max 90)

   Response shape (matches AdminEarningsChart expectations):
   {
     earnings: [{ date: "Mon", earnings: 4200 }, ...],
     summary: { total, avg, max }
   }
───────────────────────────────────────────────────────────── */
export async function GET(req: Request) {
  try {
    /* ── Aggregate completed bookings by calendar day ── */
    const rows = await prisma.$queryRaw<
      { _id: string; earnings: number }[]
    >`
      SELECT 
        TO_CHAR("completedAt", 'YYYY-MM-DD') as "_id", 
        COALESCE(SUM(fare), 0) as earnings
      FROM "Booking" 
      WHERE "status" = 'completed'::"BookingStatus"
        AND "completedAt" >= ${since}
      GROUP BY TO_CHAR("completedAt", 'YYYY-MM-DD')
      ORDER BY "_id" ASC
    `;

    /* ── Build a complete date range (fill gaps with 0) ── */
    const earningsMap = new Map(rows.map((r) => [r._id, r.earnings]));

    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const earnings = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10); // "YYYY-MM-DD"
      const label = days <= 7 ? DAY_LABELS[d.getDay()] : key.slice(5); // "MM-DD" for longer ranges
      return { date: label, earnings: earningsMap.get(key) ?? 0 };
    });

    /* ── If DB is empty, return realistic demo data ── */
    if (earnings.every((e) => e.earnings === 0)) {
      return NextResponse.json({
        earnings: generateDemoEarnings(days),
        demo: true,
      });
    }

    const total = earnings.reduce((s, e) => s + e.earnings, 0);
    const avg = Math.round(total / days);
    const max = Math.max(...earnings.map((e) => e.earnings));

    return NextResponse.json({ earnings, summary: { total, avg, max } });
  } catch (error) {
    console.error("GET /api/admin/earnings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/* ── Demo earnings generator (seeded, realistic variance) ── */
function generateDemoEarnings(days: number) {
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const base = 8500;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const label = days <= 7 ? DAY_LABELS[d.getDay()] : d.toISOString().slice(5, 10);
    // Pseudo-random but deterministic per day-of-week
    const variance = Math.sin(i * 2.4 + 1) * 3200;
    return { date: label, earnings: Math.round(base + variance) };
  });
}
