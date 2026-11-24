import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { uploadBuffer } from "@/lib/cloudinary";
import { withAuth } from "@/lib/apiRoute";

/* ──────────────────────────────────────────────────────────
   PATCH /api/partner/vehicle/pricing/edit
   Resubmit pricing after admin rejection.
   Body: multipart/form-data — image (optional), baseFare, pricePerKm, waitingCharge
────────────────────────────────────────────────────────── */
export const PATCH = withAuth(async (req, { userId }) => {
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

    // Fetch current vehicle to check status and get existing imageUrl
    const existing = await prisma.vehicle.findUnique({
      where: { ownerId: userId },
      select: { status: true, imageUrl: true }
    });

    if (!existing) {
      return NextResponse.json(
        { message: "Vehicle not found" },
        { status: 404 }
      );
    }

    if (existing.status !== "rejected") {
      return NextResponse.json(
        { message: "Pricing can only be edited after rejection" },
        { status: 403 }
      );
    }

    // Upload new image if provided, otherwise keep existing
    let imageUrl = existing.imageUrl;
    if (imageFile && imageFile.size > 0) {
      const buffer = Buffer.from(await imageFile.arrayBuffer());
      imageUrl = await uploadBuffer(
        buffer,
        `rydex/vehicle-images/${userId}`
      );
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
    console.error("PATCH /api/partner/vehicle/pricing/edit error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});

