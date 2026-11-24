import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";

/* ──────────────────────────────────────────────────────────
   GET /api/admin/vendors/[id]
   Returns a vendor's full profile: user, vehicle, docs, bank.
   Auth is enforced by middleware for all /api/* routes.
────────────────────────────────────────────────────────── */
export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const user = await prisma.user.findUnique({
      where: { id },
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
    console.error("GET /api/admin/vendors/[id] error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
}
