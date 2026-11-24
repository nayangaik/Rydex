import { NextRequest, NextResponse } from "next/server";

export async function forwardBookingRequest(req: NextRequest, userId: string, role: string, path: string[]) {
  const base = process.env.BOOKING_SERVICE_URL;
  const token = process.env.INTERNAL_SERVICE_TOKEN;
  if (!base || !token) return NextResponse.json({ success: false, message: "Booking service is not configured" }, { status: 503 });
  const target = new URL(`/api/${path.map(encodeURIComponent).join("/")}`, base);
  target.search = new URL(req.url).search;
  const headers = new Headers({ "x-internal-service-token": token, "x-user-id": userId, "x-user-role": role });
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  const body = req.method === "GET" || req.method === "HEAD" ? undefined : await req.text();
  try {
    const upstream = await fetch(target, { method: req.method, headers, body, cache: "no-store" });
    const responseHeaders = new Headers();
    const upstreamType = upstream.headers.get("content-type");
    if (upstreamType) responseHeaders.set("content-type", upstreamType);
    return new NextResponse(await upstream.arrayBuffer(), { status: upstream.status, headers: responseHeaders });
  } catch {
    return NextResponse.json({ success: false, message: "Booking service is unavailable" }, { status: 502 });
  }
}
