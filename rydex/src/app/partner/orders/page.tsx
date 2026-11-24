import { auth } from "@/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import OrdersHub from "./OrdersHub";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Orders Hub — Rydex Partner",
  description: "Manage incoming ride requests, track active rides, and view your earnings history on Rydex.",
};

export default async function PartnerOrdersPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  let user: { role?: string; vendorOnboardingStep?: number; vendorStatus?: string } | null = null;
  let vehicle: { status?: string } | null = null;

  try {
    user = (await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, vendorOnboardingStep: true, vendorStatus: true }
    })) as any;

    // Look up vehicle by owner (vehicleId is not reliably set on user doc)
    vehicle = await prisma.vehicle.findFirst({
      where: { ownerId: session.user.id },
      select: { status: true }
    });
  } catch (err) {
    console.error("Partner orders page error:", err);
    redirect("/partner");
  }

  // Only vendor / partner roles allowed
  if (user?.role !== "vendor" && user?.role !== "partner") {
    redirect("/");
  }

  // Must have an approved vehicle (pricing approved by admin sets status=approved)
  if (!vehicle || vehicle.status !== "approved") {
    redirect("/partner");
  }

  return (
    <div className="w-full min-h-screen bg-white">
      <Nav />
      <OrdersHub />
    </div>
  );
}
