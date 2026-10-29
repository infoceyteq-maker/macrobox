import type { Metadata } from "next";
import LeadRegistration from "@/components/auth/LeadRegistration";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "MacroBox | Quick Sign In",
  description: "Quick MacroBox customer sign-in with your name, phone number, and a one-time SMS code.",
};

export default async function CustomerQuickLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return (
    <LeadRegistration
      variant="quick"
      nextPath={safeNextPath(next, "/profile")}
    />
  );
}
