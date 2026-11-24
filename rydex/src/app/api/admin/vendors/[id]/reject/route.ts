import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    const body = await req.json();
    const { reason } = body;

    if (!reason) {
      return NextResponse.json({ message: "Reason is required" }, { status: 400 });
    }

    // Save rejection reason on User and reset all related entities
    await Promise.all([
      prisma.user.update({
        where: { id },
        data: { vendorStatus: "rejected", vendorRejectionReason: reason },
      }),
      prisma.vehicle.updateMany({ where: { ownerId: id }, data: { status: "rejected", rejectionReason: reason } }),
      prisma.partnerDocs.updateMany({ where: { ownerId: id }, data: { status: "rejected", rejectionReason: reason } }),
    ]);

    return NextResponse.json({ message: "Vendor rejected successfully" });
  } catch (error: any) {
    console.error("POST /api/admin/vendors/[id]/reject error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
