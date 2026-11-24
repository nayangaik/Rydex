import { auth } from "@/auth";
import prisma from "@/lib/db";
import { redirect } from "next/navigation";
import Nav from "@/components/Nav";
import Footer from "@/components/Footer";
import VendorDashboard from "@/components/VendorDashboard";

export default async function PartnerPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/");
  }

  try {
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { role: true, vendorOnboardingStep: true, vendorStatus: true }
    });

    // If not a vendor/partner, redirect home
    if (user?.role !== "vendor" && user?.role !== "partner") {
      redirect("/");
    }

    const vendorStep = (user?.vendorOnboardingStep ?? 0) as number;
    const vendorStatus = ((user?.vendorStatus ?? "pending") as
      | "pending"
      | "approved"
      | "rejected");

    return (
      <div className="w-full min-h-screen bg-white">
        <Nav />
        <VendorDashboard
          vendorStep={vendorStep}
          vendorStatus={vendorStatus}
        />
        <Footer />
      </div>
    );
  } catch (err) {
    console.error("Partner page: DB error", err);
    redirect("/");
  }
}
