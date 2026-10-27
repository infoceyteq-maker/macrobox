import type { Metadata } from "next";
import { redirect } from "next/navigation";
import CustomerProfile from "@/components/customer/CustomerProfile";
import { getCurrentActorAction } from "@/app/actions/pos";
import { safeNextPath } from "@/lib/pos/customer-auth";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MacroBox | My Profile",
  description: "Manage your MacroBox customer profile and optional delivery details.",
};

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const result = await getCurrentActorAction();
  if (!result.ok) redirect("/customer/login?next=/profile");

  return (
    <CustomerProfile
      initialProfile={result.data}
      continuePath={safeNextPath(next, "/")}
    />
  );
}
