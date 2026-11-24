import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

/* ──────────────────────────────────────────────────────────
   GET /api/admin/vehicles/[id]
   Returns a vehicle with its owner's name & email populated.
   Used by the admin pricing review page.
────────────────────────────────────────────────────────── */
export const GET = withAuth(async (req, { params }) => {
  try {
    const id = params.id;

    const raw = await prisma.vehicle.findUnique({
      where: { id },
      include: { owner: { select: { name: true, email: true } } }
    });

    if (!raw) {
      return NextResponse.json({ message: "Vehicle not found" }, { status: 404 });
    }

    // Normalise field name: pricePerKM (DB) → pricePerKm (frontend)
    const vehicle = {
      _id: raw.id,
      type: raw.type,
      number: raw.number,
      model: raw.vehicleModel,   // use vehicleModel as the display field
      imageUrl: raw.imageUrl,
      baseFare: raw.baseFare,
      pricePerKm: raw.pricePerKM,
      waitingCharge: raw.waitingCharge,
      status: raw.status,
      rejectionReason: raw.rejectionReason,
      owner: raw.owner,          // populated: { name, email }
    };

    return NextResponse.json({ vehicle });
  } catch (error) {
    console.error("GET /api/admin/vehicles/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
