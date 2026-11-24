import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

/* ──────────────────────────────────────────────────────────
   POST /api/partner/resubmit
   Vendor calls this after updating their documents/details
   following a rejection. Resets vendorStatus → "pending" so
   the admin can review the updated application.
────────────────────────────────────────────────────────── */
export const POST = withAuth(async (req, { userId }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { vendorStatus: true }
    });

    if (!user) {
      return NextResponse.json({ message: "User not found" }, { status: 404 });
    }

    if (user.vendorStatus !== "rejected") {
      return NextResponse.json(
        { message: "Application is not in rejected state" },
        { status: 400 }
      );
    }

    // Reset all entities back to pending so admin sees the updated application
    await Promise.all([
      prisma.user.update({
        where: { id: userId },
        data: { vendorStatus: "pending", vendorRejectionReason: "" }
      }),
      prisma.vehicle.update({
        where: { ownerId: userId },
        data: { status: "pending", rejectionReason: "" }
      }),
      prisma.partnerDocs.update({
        where: { ownerId: userId },
        data: { status: "pending", rejectionReason: "" }
      }),
      // Bank doesn't need re-review — keep it verified
      prisma.partnerBank.update({
        where: { ownerId: userId },
        data: { status: "verified" }
      }),
    ]);

    return NextResponse.json({ message: "Application resubmitted successfully" });
  } catch (error: any) {
    console.error("POST /api/partner/resubmit error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
