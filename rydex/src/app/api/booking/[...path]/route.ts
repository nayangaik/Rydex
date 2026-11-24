import { NextRequest } from "next/server";
import { auth } from "@/auth";
import { forwardBookingRequest } from "@/lib/bookingProxy";

async function handle(req: NextRequest, context: { params: Promise<{ path: string[] }> }) {
  const session = await auth();
  if (!session?.user?.id || !session.user.role) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { path } = await context.params;
  return forwardBookingRequest(req, session.user.id, session.user.role, ["booking", ...path]);
}
export const GET = handle;
export const POST = handle;
