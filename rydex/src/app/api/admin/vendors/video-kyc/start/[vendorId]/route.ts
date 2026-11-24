import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import crypto from "crypto";

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ vendorId: string }> }
) {
  try {
    const { vendorId } = await params;
    
    const user = await prisma.user.findUnique({ where: { id: vendorId } });
    if (!user) {
      return NextResponse.json({ message: "Vendor not found" }, { status: 404 });
    }

    // Generate a unique room ID for the video call
    const roomId = crypto.randomUUID();

    await prisma.user.update({
      where: { id: vendorId },
      data: { videoKycStatus: "in_progress", videoKycRoomId: roomId }
    });

    return NextResponse.json({ roomId });
  } catch (error: any) {
    console.error("PATCH /api/admin/vendors/video-kyc/start/[vendorId] error:", error);
    return NextResponse.json(
      { message: "Internal server error" },
      { status: 500 }
    );
  }
}
