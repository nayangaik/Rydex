import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

export const GET = withAuth(async (req, { userId }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { password, otp, otpExpiry, ...userWithoutSensitiveInfo } = user;

    return NextResponse.json(userWithoutSensitiveInfo);
  } catch (error) {
    console.error("GET /api/me error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});
