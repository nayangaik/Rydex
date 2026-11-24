import { NextResponse } from "next/server";
import { withAuth } from "@/lib/apiRoute";

const serviceUrl = process.env.USER_SERVICE_URL ?? "http://localhost:5003";

/** GET /api/admin/users/[userId]/audit — audit log for a specific user */
export const GET = withAuth(async (_req, { userId: actorId, role, params }) => {
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try {
    const response = await fetch(
      `${serviceUrl}/api/users/${encodeURIComponent(params.userId)}/audit`,
      {
        headers: {
          "Content-Type": "application/json",
          "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
          "x-user-id": actorId,
          "x-user-role": role,
        },
        cache: "no-store",
      }
    );
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "User service unavailable" }, { status: 503 });
  }
});

