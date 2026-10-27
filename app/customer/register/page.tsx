import type { Metadata } from "next";
import CustomerAuthForm from "@/components/auth/CustomerAuthForm";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Customer Phone Registration",
  description: "Create a MacroBox customer account with a one-time SMS code.",
};

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <CustomerAuthForm nextPath={safeNextPath(next, "/profile")} />;
}
