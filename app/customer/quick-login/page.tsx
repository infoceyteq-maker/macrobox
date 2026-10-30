import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "Baduma.sl | WhatsApp Sign In",
  description: "Passwordless customer sign-in with a 6-digit WhatsApp code.",
};

export default async function CustomerQuickLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/customer/login?next=${encodeURIComponent(safeNextPath(next, "/profile"))}`);
}
