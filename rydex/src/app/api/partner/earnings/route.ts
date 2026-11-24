import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

/* ─────────────────────────────────────────────────────────────
   GET /api/partner/earnings

   Returns a partner's daily earnings for the last N days,
   filtered by their vendorId.

   Query params:
     ?days=7   (default 7, max 90)

   Response shape:
   {
     earnings: [{ date: "Mon", earnings: 1200 }, ...],
     summary: { total, avg, max },
     demo: boolean   // true when returning seed data
   }
───────────────────────────────────────────────────────────── */
export const GET = withAuth(async (req: NextRequest, { userId }) => {
  try {
    const { searchParams } = new URL(req.url);
    const days = Math.min(Number(searchParams.get("days") || "7"), 90);

    /* ── Resolve vendorId (the authenticated user IS the vendor) ── */
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vehicleId: true, role: true }
    });

    if (!user) {
      return NextResponse.json({ error: "Vendor not found" }, { status: 404 });
    }

    const since = new Date();
    since.setDate(since.getDate() - days + 1);
    since.setHours(0, 0, 0, 0);

    /* ── Aggregate completed bookings by day for this vendor ── */
    const rows = await prisma.$queryRaw<
      { _id: string; earnings: number; trips: number }[]
    >`
      SELECT 
        TO_CHAR("completedAt", 'YYYY-MM-DD') as "_id", 
        COALESCE(SUM(fare), 0) as earnings, 
        COUNT(*)::int as trips 
      FROM "Booking" 
      WHERE "vendorId" = ${userId} 
        AND "status" = 'completed'::"BookingStatus"
        AND "completedAt" >= ${since}
      GROUP BY TO_CHAR("completedAt", 'YYYY-MM-DD')
      ORDER BY "_id" ASC
    `;

    /* ── Build full date range, filling gaps with 0 ── */
    const earningsMap = new Map(rows.map((r) => [r._id, r]));
    const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

    const earnings = Array.from({ length: days }, (_, i) => {
      const d = new Date(since);
      d.setDate(since.getDate() + i);
      const key = d.toISOString().slice(0, 10);
      const label = days <= 7 ? DAY_LABELS[d.getDay()] : key.slice(5);
      const row = earningsMap.get(key);
      return { date: label, earnings: row?.earnings ?? 0, trips: row?.trips ?? 0 };
    });

    /* ── Fallback demo data when collection is empty ── */
    if (earnings.every((e) => e.earnings === 0)) {
      return NextResponse.json({
        earnings: generateDemoEarnings(days),
        summary: { total: 0, avg: 0, max: 0 },
        demo: true,
      });
    }

    const total = earnings.reduce((s, e) => s + e.earnings, 0);
    const totalTrips = earnings.reduce((s, e) => s + e.trips, 0);
    const avg = Math.round(total / days);
    const max = Math.max(...earnings.map((e) => e.earnings));

    return NextResponse.json({
      earnings,
      summary: { total, avg, max, totalTrips },
      demo: false,
    });
  } catch (error) {
    console.error("GET /api/partner/earnings error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
});

/* ── Deterministic demo data so the chart is never blank ── */
function generateDemoEarnings(days: number) {
  const DAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const base = 1800;
  return Array.from({ length: days }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - (days - 1 - i));
    const label = days <= 7 ? DAY_LABELS[d.getDay()] : d.toISOString().slice(5, 10);
    const variance = Math.sin(i * 1.9 + 0.5) * 900;
    return {
      date: label,
      earnings: Math.round(base + variance),
      trips: Math.round(3 + Math.abs(Math.sin(i)) * 4),
    };
  });
}
