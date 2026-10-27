import type { Metadata } from "next";
import StaffLoginForm from "@/components/auth/StaffLoginForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Master Admin Login",
  description: "Pre-provisioned Master Admin authentication. No public registration.",
};

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <StaffLoginForm
      portal="admin"
      title="Master Admin"
      subtitle="Unified control for orders, employees, financials, menu visibility, documents, delivery evidence, and transport settings."
      nextPath={safeNextPath(next, "/admin")}
      allowedRoles={["ADMIN"]}
    />
  );
}
