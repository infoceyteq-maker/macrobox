import type { Metadata } from "next";
import LeadRegistration from "@/components/auth/LeadRegistration";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Customer Registration",
  description: "Register with your name and phone number, verified by a one-time SMS code.",
};

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <LeadRegistration nextPath={safeNextPath(next, "/")} />;
}
