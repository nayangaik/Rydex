import { NextResponse } from "next/server";
import { withAuth } from "@/lib/apiRoute";

export const POST = withAuth(async (req, { userId, role }) => {
  try {
    const response = await fetch(`${process.env.USER_SERVICE_URL ?? "http://localhost:5003"}/api/users/me/requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
        "x-user-id": userId,
        "x-user-role": role,
      },
      body: JSON.stringify(await req.json()),
      cache: "no-store",
    });
    return NextResponse.json(await response.json(), { status: response.status });
  } catch {
    return NextResponse.json({ error: "User service unavailable" }, { status: 503 });
  }
});
