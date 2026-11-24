import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { uploadBuffer } from "@/lib/cloudinary";
import { withAuth } from "@/lib/apiRoute";

/* ──────────────────────────────────────────────────────────
   GET /api/partner/vehicle/pricing
   Returns the vendor's current pricing data from their vehicle
────────────────────────────────────────────────────────── */
export const GET = withAuth(async (req, { userId }) => {
  try {
    const vehicle = await prisma.vehicle.findUnique({
      where: { ownerId: userId },
      select: { baseFare: true, pricePerKM: true, waitingCharge: true, imageUrl: true, status: true, rejectionReason: true }
    });

    if (!vehicle) {
      return NextResponse.json({ pricing: null });
    }

    // Normalise field name to camelCase for the frontend (pricePerKM → pricePerKm)
    const pricing = {
      baseFare: vehicle.baseFare,
      pricePerKm: vehicle.pricePerKM,
      waitingCharge: vehicle.waitingCharge,
      imageUrl: vehicle.imageUrl,
      status: vehicle.status,
      rejectionReason: vehicle.rejectionReason,
    };

    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("GET /api/partner/vehicle/pricing error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

/* ──────────────────────────────────────────────────────────
   POST /api/partner/vehicle/pricing
   Submit pricing for the first time (or update after approval)
   Body: multipart/form-data — image (optional), baseFare, pricePerKm, waitingCharge
────────────────────────────────────────────────────────── */
export const POST = withAuth(async (req, { userId }) => {
  try {
    const formData = await req.formData();

    const baseFare = Number(formData.get("baseFare"));
    const pricePerKm = Number(formData.get("pricePerKm"));
    const waitingCharge = Number(formData.get("waitingCharge"));
    const imageFile = formData.get("image") as File | null;

    if (!baseFare || baseFare <= 0) {
      return NextResponse.json(
        { message: "Base Fare must be greater than 0" },
        { status: 400 }
      );
    }
    if (!pricePerKm || pricePerKm <= 0) {
      return NextResponse.json(
        { message: "Price per KM must be greater than 0" },
        { status: 400 }
      );
    }
    if (waitingCharge < 0) {
      return NextResponse.json(
        { message: "Waiting charge cannot be negative" },
        { status: 400 }
      );
    }

    // Find existing vehicle first (to get current imageUrl)
    const existing = await prisma.vehicle.findUnique({
      where: { ownerId: userId },
      select: { imageUrl: true }
    });
    if (!existing) {
      return NextResponse.json(
        { message: "Vehicle not found. Complete vehicle registration first." },
        { status: 404 }
      );
    }

    // Upload image if provided, otherwise keep existing
    let imageUrl = existing.imageUrl;
    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      imageUrl = await uploadBuffer(buffer, `rydex/vehicle-images/${userId}`);
    }

    const vehicle = await prisma.vehicle.update({
      where: { ownerId: userId },
      data: {
        baseFare,
        pricePerKM: pricePerKm,
        waitingCharge,
        imageUrl,
        status: "pending",
        rejectionReason: "",
      },
      select: { baseFare: true, pricePerKM: true, waitingCharge: true, imageUrl: true, status: true, rejectionReason: true }
    });

    // Advance onboarding step to 6 (Pricing submitted)
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { vendorOnboardingStep: true } });
    if (user && user.vendorOnboardingStep < 6) {
      await prisma.user.update({
        where: { id: userId },
        data: { vendorOnboardingStep: 6 },
      });
    }

    const pricing = {
      baseFare: vehicle!.baseFare,
      pricePerKm: vehicle!.pricePerKM,
      waitingCharge: vehicle!.waitingCharge,
      imageUrl: vehicle!.imageUrl,
      status: vehicle!.status,
      rejectionReason: vehicle!.rejectionReason,
    };

    return NextResponse.json({ pricing });
  } catch (error) {
    console.error("POST /api/partner/vehicle/pricing error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
