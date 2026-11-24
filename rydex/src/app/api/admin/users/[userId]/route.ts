import { NextResponse } from "next/server";
import { withAuth } from "@/lib/apiRoute";

const serviceUrl = process.env.USER_SERVICE_URL ?? "http://localhost:5003";

function serviceHeaders(actorId: string, role: string) {
  return {
    "Content-Type": "application/json",
    "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
    "x-user-id": actorId,
    "x-user-role": role,
  };
}

/** GET /api/admin/users/[userId] — fetch account + profile + requests */
export const GET = withAuth(async (_req, { userId: actorId, role, params }) => {
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try {
    const response = await fetch(
      `${serviceUrl}/api/users/${encodeURIComponent(params.userId)}`,
      { headers: serviceHeaders(actorId, role), cache: "no-store" }
    );
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "User service unavailable" }, { status: 503 });
  }
});

/** PATCH /api/admin/users/[userId] — suspend or reactivate */
export const PATCH = withAuth(async (req, { userId: actorId, role, params }) => {
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try {
    const response = await fetch(
      `${serviceUrl}/api/users/${encodeURIComponent(params.userId)}/status`,
      {
        method: "PATCH",
        headers: serviceHeaders(actorId, role),
        body: JSON.stringify(await req.json()),
        cache: "no-store",
      }
    );
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "User service unavailable" }, { status: 503 });
  }
});
