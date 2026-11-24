import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

/* ──────────────────────────────────────────────────────────
   POST /api/admin/vehicles/[id]/reject
   Admin rejects vendor pricing for a vehicle.
   Body: { reason: string }
   [id] = Vehicle._id
────────────────────────────────────────────────────────── */
export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params.id;
    const body = await req.json();
    const reason = body?.reason?.trim();

    if (!reason) {
      return NextResponse.json(
        { message: "A rejection reason is required" },
        { status: 400 }
      );
    }

    // Only admins can call this route
    const caller = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    if (caller?.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    const updated = await prisma.vehicle.update({
      where: { id },
      data: { status: "rejected", rejectionReason: reason }
    }).catch(() => null);

    if (!updated) {
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Pricing rejected" });
  } catch (error) {
    console.error("POST /api/admin/vehicles/[id]/reject error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
