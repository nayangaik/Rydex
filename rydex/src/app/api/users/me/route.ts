import { NextResponse } from "next/server";
import { withAuth } from "@/lib/apiRoute";

const serviceUrl = process.env.USER_SERVICE_URL ?? "http://localhost:5003";
async function callService(path: string, userId: string, role: string, init?: RequestInit) {
  return fetch(`${serviceUrl}${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      "x-internal-service-token": process.env.INTERNAL_SERVICE_TOKEN ?? "",
      "x-user-id": userId,
      "x-user-role": role,
      ...init?.headers,
    },
    cache: "no-store",
  });
}

export const GET = withAuth(async (_req, { userId, role }) => {
  const response = await callService("/api/users/me", userId, role);
  return NextResponse.json(await response.json(), { status: response.status });
});

export const PUT = withAuth(async (req, { userId, role }) => {
  const response = await callService("/api/users/me/profile", userId, role, { method: "PUT", body: JSON.stringify(await req.json()) });
  return NextResponse.json(await response.json(), { status: response.status });
});
