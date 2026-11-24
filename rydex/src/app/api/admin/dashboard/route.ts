import { NextResponse } from "next/server";
import prisma from "@/lib/db";

export async function GET() {
  try {
    const [totalVendors, approved, pending, rejected] = await Promise.all([
      prisma.user.count({ where: { role: { in: ["vendor", "partner"] } } }),
      prisma.user.count({ where: { role: { in: ["vendor", "partner"] }, vendorStatus: "approved" } }),
      prisma.user.count({ where: { role: { in: ["vendor", "partner"] }, vendorStatus: "pending" } }),
      prisma.user.count({ where: { role: { in: ["vendor", "partner"] }, vendorStatus: "rejected" } }),
    ]);

    const stats = { totalVendors, approved, pending, rejected };

    // 2. Pending Vendors — include both 'vendor' and 'partner' roles
    const pendingVendorsData = await prisma.user.findMany({
      where: {
        role: { in: ["vendor", "partner"] },
        vendorStatus: "pending",
      },
      select: { id: true, name: true, email: true, vendorStatus: true }
    });

    const pendingVendors = pendingVendorsData.map(v => ({
      _id: v.id,
      name: v.name,
      email: v.email,
      vendorStatus: v.vendorStatus
    }));

    // 3. Pending Vehicles — only for vendors whose profile is already approved
    const approvedVendors = await prisma.user.findMany({
      where: {
        role: { in: ["vendor", "partner"] },
        vendorStatus: "approved",
      },
      select: { id: true }
    });
    const approvedVendorIds = approvedVendors.map(v => v.id);

    const pendingVehiclesData = await prisma.vehicle.findMany({
      where: {
        status: "pending",
        ownerId: { in: approvedVendorIds },
      },
      include: { owner: { select: { name: true, email: true } } }
    });

    const pendingVehicles = pendingVehiclesData.map((v: any) => ({
      _id: v.id,
      ownerName: v.owner?.name,
      ownerEmail: v.owner?.email,
      type: v.type,
      vehicleModel: v.vehicleModel,
      number: v.number,
      status: v.status,
    }));

    return NextResponse.json({
      stats,
      pendingVendors,
      pendingVehicles,
    });
  } catch (error) {
    console.error("GET /api/admin/dashboard error:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
