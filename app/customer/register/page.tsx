import type { Metadata } from "next";
import CustomerAuthForm from "@/components/auth/CustomerAuthForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Create Customer Account",
  description: "Register for the MacroBox digital menu with your email and phone number.",
};

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <CustomerAuthForm
      initialMode="register"
      nextPath={safeNextPath(next, "/orders")}
    />
  );
}
