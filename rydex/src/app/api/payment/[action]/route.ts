import { NextRequest } from "next/server";
import { withAuth } from "@/lib/apiRoute";
import { forwardBookingRequest } from "@/lib/bookingProxy";

export const POST = withAuth((req: NextRequest, { userId, role, params }) => forwardBookingRequest(req, userId, role, ["payment", params.action]));
