import type { Metadata } from "next";
import WhatsAppOtpLogin from "@/components/auth/WhatsAppOtpLogin";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "Baduma.sl | WhatsApp Sign In",
  description: "Passwordless Baduma.sl customer sign-in with a 6-digit WhatsApp code.",
};

export default async function CustomerLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  return <WhatsAppOtpLogin nextPath={safeNextPath(next, "/profile")} />;
}
