import { NextResponse } from "next/server";
import { withAuth } from "@/lib/apiRoute";

export const GET = withAuth(async (_req, { userId, role }) => {
  if (role !== "admin") return NextResponse.json({ error: "Admin access required" }, { status: 403 });
  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL ?? "http://localhost:5003"}/api/users`, {
      headers: { "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "", "x-user-id": userId, "x-user-role": role },
      cache: "no-store",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch { return NextResponse.json({ error: "User service unavailable" }, { status: 503 }); }
});
