import { NextRequest } from "next/server";
import { withAuth } from "@/lib/apiRoute";
import { forwardBookingRequest } from "@/lib/bookingProxy";

export const GET = withAuth((req: NextRequest, { userId, role }) => forwardBookingRequest(req, userId, role, ["partner", "bookings", "active"]));
