import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({ where: { id }, select: { vendorOnboardingStep: true } });
    const step = Math.max(user?.vendorOnboardingStep || 0, 4);

    // Update User vendorStatus and step
    await prisma.user.update({
      where: { id },
      data: {
        vendorStatus: "approved",
        videoKycStatus: "pending",
        vendorOnboardingStep: step,
      }
    });

    // Update related entities
    await Promise.all([
      prisma.vehicle.updateMany({ where: { ownerId: id }, data: { status: "approved" } }),
      prisma.partnerDocs.updateMany({ where: { ownerId: id }, data: { status: "approved" } }),
      prisma.partnerBank.updateMany({ where: { ownerId: id }, data: { status: "verified" } }),
    ]);

    return NextResponse.json({ message: "Vendor approved successfully" });
  } catch (error: any) {
    console.error("POST /api/admin/vendors/[id]/approve error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
