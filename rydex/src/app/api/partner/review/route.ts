import { NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

export const GET = withAuth(async (req, { userId }) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        email: true,
        vendorStatus: true,
        ownedVehicle: true,
        partnerDocs: true,
        partnerBank: true
      }
    });

    if (!user) {
      return NextResponse.json({ message: "Vendor not found" }, { status: 404 });
    }

    const vehicle = user.ownedVehicle;
    const documents = user.partnerDocs;
    const bank = user.partnerBank;

    return NextResponse.json({
      vendor: {
        _id: user.id,
        name: user.name,
        email: user.email,
        vendorStatus: user.vendorStatus,
        vehicle: vehicle
          ? {
              type: vehicle.type,
              number: vehicle.number,
              model: vehicle.vehicleModel,
            }
          : null,
        documents: documents
          ? {
              aadhaarUrl: documents.aadharUrl,
              licenseUrl: documents.licenseUrl,
              rcUrl: documents.rcUrl,
            }
          : null,
        bank: bank
          ? {
              accountHolderName: bank.accountHolder,
              ifsc: bank.ifsc,
              upi: bank.upi,
            }
          : null,
      },
    });
  } catch (error: any) {
    console.error("GET /api/partner/review error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
