import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/db";
import { withAuth } from "@/lib/apiRoute";

export const GET = withAuth(async (req, { userId }) => {
  try {
    const bank = await prisma.partnerBank.findUnique({ where: { ownerId: userId } });

    if (bank) {
      return NextResponse.json({
        bank: {
          ...bank,
          accountHolderName: bank.accountHolder,
        },
      });
    }

    return NextResponse.json({ bank: null });
  } catch (error) {
    console.error("GET /api/partner/bank error:", error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
});

export const POST = withAuth(async (req, { userId }) => {
  try {
    const body = await req.json();
    const { name, account, ifsc, upi, mobileNumber } = body;

    if (!name || !account || !ifsc || !mobileNumber) {
      return NextResponse.json(
        { message: "name, account, ifsc, and mobileNumber are required" },
        { status: 400 }
      );
    }

    const bank = await prisma.partnerBank.upsert({
      where: { ownerId: userId },
      update: {
        accountHolder: name,
        accountNumber: account,
        ifsc,
        upi,
        mobileNumber,
        status: "added",
      },
      create: {
        ownerId: userId,
        accountHolder: name,
        accountNumber: account,
        ifsc,
        upi,
        mobileNumber,
        status: "added",
      }
    });

    // Assuming bank setup is a step in onboarding, update vendorOnboardingStep
    const user = await prisma.user.findUnique({ where: { id: userId }, select: { vendorOnboardingStep: true } });
    if (user && user.vendorOnboardingStep < 3) {
      await prisma.user.update({
        where: { id: userId },
        data: { vendorOnboardingStep: 3 },
      });
    }

    return NextResponse.json({ bank });
  } catch (error: any) {
    console.error("POST /api/partner/bank error:", error);
    return NextResponse.json({ message: "Internal server error" }, { status: 500 });
  }
});
