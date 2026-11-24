import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

/* ──────────────────────────────────────────────────────────
   POST /api/admin/vehicles/[id]/approve
   Admin approves vendor pricing for a vehicle.
   [id] = Vehicle._id
────────────────────────────────────────────────────────── */
export const POST = withAuth(async (req, { userId, params }) => {
  try {
    const id = params.id;

    // Only admins can call this route
    const caller = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });
    if (caller?.role !== "admin") {
      return NextResponse.json({ message: "Forbidden" }, { status: 403 });
    }

    // Get vehicle owner before updating (needed to advance their step)
    const vehicle = await prisma.vehicle.findUnique({
      where: { id },
      select: { ownerId: true }
    });
    if (!vehicle) {
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }

    await prisma.vehicle.update({
      where: { id },
      data: { status: "approved", rejectionReason: "" },
    });

    // Advance vendor's onboarding step to 7 (Final Review)
    const owner = await prisma.user.findUnique({
      where: { id: vehicle.ownerId },
      select: { vendorOnboardingStep: true }
    });
    if (owner && owner.vendorOnboardingStep < 7) {
      await prisma.user.update({
        where: { id: vehicle.ownerId },
        data: { vendorOnboardingStep: 7 }
      });
    }

    return NextResponse.json({ message: "Pricing approved successfully" });
  } catch (error) {
    console.error("POST /api/admin/vehicles/[id]/approve error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
