import { redirect } from "next/navigation";

/**
 * /vendor/orders is an alias — vendor == partner in this codebase.
 * Permanently redirect to the canonical partner route.
 */
export default function VendorOrdersRedirect() {
  redirect("/partner/orders");
}
