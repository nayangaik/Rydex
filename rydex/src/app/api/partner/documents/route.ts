import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { uploadBuffer } from "@/lib/cloudinary";
import { withAuth } from "@/lib/apiRoute";

export const GET = withAuth(async (req, { userId }) => {
  try {
    const documents = await prisma.partnerDocs.findUnique({
      where: { ownerId: userId }
    });

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("GET /api/partner/documents error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const formData = await req.formData();

    const aadhaar = formData.get("aadhaar") as File | null;
    const license = formData.get("license") as File | null;
    const rc = formData.get("rc") as File | null;

    if (!aadhaar || !license || !rc) {
      return NextResponse.json(
        { message: "aadhaar, license and rc files are required" },
        { status: 400 }
      );
    }

    const documents = await prisma.partnerDocs.upsert({
      where: { ownerId: userId },
      update: {
        aadharUrl,
        licenseUrl,
        rcUrl,
        status: "pending",
      },
      create: {
        ownerId: userId,
        aadharUrl,
        licenseUrl,
        rcUrl,
        status: "pending",
      }
    });

    const user = await prisma.user.findUnique({ where: { id: userId }, select: { vendorOnboardingStep: true } });
    if (user && user.vendorOnboardingStep < 2) {
      await prisma.user.update({
        where: { id: userId },
        data: { vendorOnboardingStep: 2 },
      });
    }

    return NextResponse.json({ documents });
  } catch (error) {
    console.error("POST /api/partner/documents error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
