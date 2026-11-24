import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    // Fetch vendors whose videoKycStatus is "pending" or "in_progress"
    const pendingKycUsersData = await prisma.user.findMany({
      where: {
        role: "vendor",
        videoKycStatus: { in: ["pending", "in_progress"] },
      },
      select: {
        id: true,
        name: true,
        email: true,
        videoKycStatus: true,
        videoKycRoomId: true,
      }
    });

    const pendingKycUsers = pendingKycUsersData.map(u => ({ ...u, _id: u.id }));

    return NextResponse.json(pendingKycUsers);
  } catch (error) {
    console.error("GET /api/admin/vendors/video-kyc/pending error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
