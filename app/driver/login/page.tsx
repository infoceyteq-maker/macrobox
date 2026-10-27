import type { Metadata } from "next";
import StaffLoginForm from "@/components/auth/StaffLoginForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Driver Login",
  description: "Mobile delivery portal authentication for assigned MacroBox drivers.",
};

export default async function DriverLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <StaffLoginForm
      portal="driver"
      title="Driver Portal"
      subtitle="View assigned deliveries, follow the route, calculate the final e-bill, capture a signature, and confirm cash collection."
      nextPath={safeNextPath(next, "/driver")}
      allowedRoles={["DRIVER", "ADMIN"]}
    />
  );
}
