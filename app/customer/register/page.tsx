import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const metadata: Metadata = {
  title: "Baduma.sl | WhatsApp Sign In",
  description: "Customer accounts are created automatically after WhatsApp OTP verification.",
};

export default async function CustomerRegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  redirect(`/customer/login?next=${encodeURIComponent(safeNextPath(next, "/profile"))}`);
}
