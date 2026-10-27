import type { Metadata } from "next";
import StaffLoginForm from "@/components/auth/StaffLoginForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Front Desk Login",
  description: "Front Desk and POS authentication for MacroBox employees.",
};

export default async function FrontDeskLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <StaffLoginForm
      portal="frontdesk"
      title="Front Desk / POS"
      subtitle="Accept incoming orders, coordinate kitchen preparation, assign drivers, dispatch deliveries, and print kitchen or customer documents."
      nextPath={safeNextPath(next, "/pos")}
      allowedRoles={["ADMIN", "MANAGER", "FRONT_DESK", "KITCHEN"]}
    />
  );
}
