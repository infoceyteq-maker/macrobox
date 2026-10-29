import type { Metadata } from "next";
import CustomerEmailOtpForm from "@/components/auth/CustomerEmailOtpForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Customer Email Sign In",
  description: "Passwordless customer sign-in with a one-time email code.",
};

export default async function CustomerEmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <CustomerEmailOtpForm nextPath={safeNextPath(next, "/profile")} />;
}
