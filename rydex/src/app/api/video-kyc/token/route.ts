import { NextRequest, NextResponse } from "next/server";
import { ZegoUIKitPrebuilt } from "@zegocloud/zego-uikit-prebuilt";
import { auth } from "@/auth";
import prisma from "@/lib/db";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { roomId } = await req.json().catch(() => ({}));
  if (typeof roomId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(roomId)) return NextResponse.json({ error: "Valid roomId is required" }, { status: 400 });
  const user = await prisma.user.findUnique({ where: { id: session.user.id }, select: { id: true, name: true, email: true, role: true, videoKycRoomId: true } });
  if (!user) return NextResponse.json({ error: "User not found" }, { status: 404 });
  if (user.role !== "admin" && user.videoKycRoomId !== roomId) return NextResponse.json({ error: "KYC room access denied" }, { status: 403 });
  const appID = Number(process.env.ZEGO_APP_ID);
  const serverSecret = process.env.ZEGO_SERVER_SECRET;
  if (!Number.isInteger(appID) || appID <= 0 || !serverSecret) return NextResponse.json({ error: "Video KYC is not configured" }, { status: 503 });
  const displayName = user.role === "admin" ? "Admin" : `${user.name} (${user.email})`;
  const kitToken = ZegoUIKitPrebuilt.generateKitTokenForTest(appID, serverSecret, roomId, user.id, displayName);
  return NextResponse.json({ appID, kitToken }, { headers: { "Cache-Control": "no-store" } });
}
