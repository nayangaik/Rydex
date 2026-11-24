import { NextResponse } from "next/server";
import { createHmac } from "node:crypto";
import { auth } from "@/auth";

export async function GET() {
  const session = await auth();
  const id = session?.user?.id;
  const role = session?.user?.role;
  const secret = process.env.SOCKET_AUTH_SECRET;
  if (!id || !role) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  if (!secret) return NextResponse.json({ error: "Socket authentication is not configured" }, { status: 503 });
  const body = Buffer.from(JSON.stringify({ sub: id, role, exp: Date.now() + 5 * 60_000 })).toString("base64url");
  const signature = createHmac("sha256", secret).update(body).digest("base64url");
  return NextResponse.json({ token: `${body}.${signature}` }, { headers: { "Cache-Control": "no-store" } });
}
