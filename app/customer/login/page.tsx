import type { Metadata } from "next";
import CustomerAuthForm from "@/components/auth/CustomerAuthForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Customer Sign In",
  description: "Sign in with your registered email address or phone number.",
};

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <CustomerAuthForm
      initialMode="signin"
      nextPath={safeNextPath(next, "/orders")}
    />
  );
}
