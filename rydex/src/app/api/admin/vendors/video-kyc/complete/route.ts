import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

const SOCKET_SERVER = process.env.NEXT_PUBLIC_SOCKET_SERVER || "http://localhost:8000";

export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json();
    const { roomId, action, reason } = body;

    if (!roomId || !action) {
      return NextResponse.json(
        { message: "roomId and action are required" },
        { status: 400 }
      );
    }

    if (!["approve", "reject"].includes(action)) {
      return NextResponse.json(
        { message: "action must be 'approve' or 'reject'" },
        { status: 400 }
      );
    }

    if (action === "reject" && !reason?.trim()) {
      return NextResponse.json(
        { message: "A rejection reason is required" },
        { status: 400 }
      );
    }

    const user = await prisma.user.findFirst({ where: { videoKycRoomId: roomId } });
    if (!user) {
      return NextResponse.json(
        { message: "No vendor found for this room ID" },
        { status: 404 }
      );
    }

    const updateData: any = { videoKycRoomId: null };
    if (action === "approve") {
      updateData.videoKycStatus = "approved";
      updateData.videoKycRejectionReason = null;
      if (user.vendorOnboardingStep < 5) {
        updateData.vendorOnboardingStep = 5;
      }
    } else {
      updateData.videoKycStatus = "rejected";
      updateData.videoKycRejectionReason = reason.trim();
    }

    await prisma.user.update({
      where: { id: user.id },
      data: updateData
    });

    // SSE automatically handles notifying the vendor by polling the updated DB state.

    return NextResponse.json({
      message: `Vendor KYC ${action === "approve" ? "approved" : "rejected"} successfully`,
    });
  } catch (error: any) {
    console.error("PATCH /api/admin/vendors/video-kyc/complete error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
