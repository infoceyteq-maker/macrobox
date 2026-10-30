import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "Baduma.sl | WhatsApp Sign In",
  description: "Customer sign-in is WhatsApp OTP only — no email login form.",
};

export default async function CustomerEmailLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/customer/login?next=${encodeURIComponent(safeNextPath(next, "/profile"))}`);
}
