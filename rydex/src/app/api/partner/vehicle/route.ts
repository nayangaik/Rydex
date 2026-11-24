import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

export const GET = withAuth(async (req, { userId }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { ownedVehicle: true }
    });

    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const { password, otp, otpExpiry, ownedVehicle, ...userWithoutSensitiveInfo } = user;

    return NextResponse.json({ user: userWithoutSensitiveInfo, vehicle: ownedVehicle });
  } catch (error) {
    console.error("GET /api/partner/vehicle error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const { type, number, vehicleModel } = body;

    if (!type || !number || !vehicleModel) {
      return NextResponse.json(
        { message: "type, number and vehicleModel are required" },
        { status: 400 }
      );
    }

    const vehicle = await prisma.vehicle.upsert({
      where: { ownerId: userId },
      update: {
        type,
        number,
        vehicleModel,
      },
      create: {
        ownerId: userId,
        type,
        number,
        vehicleModel,
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { vendorOnboardingStep: true } });
    if (user && user.vendorOnboardingStep < 1) {
       await prisma.user.update({ where: { id: userId }, data: { role: "vendor", vendorOnboardingStep: 1 } });
    } else {
       await prisma.user.update({ where: { id: userId }, data: { role: "vendor" } });
    }

    return NextResponse.json({ vehicle });
  } catch (error: any) {
    if (error?.code === "P2002") {
      return NextResponse.json(
        { message: "Vehicle number already registered" },
        { status: 409 }
      );
    }
    console.error("POST /api/partner/vehicle error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
