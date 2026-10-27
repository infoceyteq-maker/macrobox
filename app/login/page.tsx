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
      subtitle="Sign in to the shared POS workspace. Staff accounts are issued by administration only."
      nextPath={safeNextPath(next, "/pos")}
    />
  );
}
