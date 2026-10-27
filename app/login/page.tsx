import type { Metadata } from "next";
import StaffLoginForm from "@/components/auth/StaffLoginForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Employee Login",
  description: "General staff authentication for the MacroBox POS system.",
};

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <StaffLoginForm
      portal="general"
      title="Employee Portal"
      subtitle="Sign in to the shared POS workspace. Use the dedicated Master Admin, Driver, or Front Desk login for directly bookmarked portals."
      nextPath={safeNextPath(next, "/pos")}
    />
  );
}
