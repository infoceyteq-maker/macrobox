import Link from "next/link";
import { redirect } from "next/navigation";

import { getCurrentActorAction } from "@/app/actions/pos";
import PortalShell from "@/components/layout/PortalShell";
import { cn, NEU } from "@/components/ui/neu";

export const dynamic = "force-dynamic";

function initialsFor(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0])
    .join("")
    .toUpperCase();
}

export default async function SettingsPage() {
  const result = await getCurrentActorAction();
  if (!result.ok || result.data.role !== "CUSTOMER") {
    redirect("/customer/login?next=/settings");
  }

  const profile = result.data;

  return (
    <PortalShell title="Settings" subtitle="Manage your MacroBox customer account">
      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-center gap-4">
          <span
            role="img"
            aria-label="Profile image"
            className="flex h-16 w-16 items-center justify-center rounded-full bg-[#8FBC8F] font-display text-lg font-bold text-[#22301f] shadow-[5px_5px_11px_#a9b9a7,-5px_-5px_11px_#ffffff]"
          >
            {initialsFor(profile.name)}
          </span>
          <div className="min-w-0">
            <h2 className="font-display text-xl font-bold">{profile.name}</h2>
            <p className="mt-1 break-all text-sm text-[#5f6d65]">{profile.email ?? "Email not linked"}</p>
            <p className="text-sm text-[#5f6d65]">{profile.phone ?? "Phone not available"}</p>
          </div>
        </div>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Profile details</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">
            Update your name and the delivery details used to pre-fill checkout.
          </p>
          <Link href="/profile" className={cn(NEU.buttonPrimary, "mt-4 inline-block")}>
            Manage My Profile
          </Link>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Sign-in methods</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">
            Phone sign-in remains the primary secure method. Optional email linking is managed from your profile.
          </p>
          <Link href="/profile" className={cn(NEU.button, "mt-4 inline-block")}>
            Review sign-in options
          </Link>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Orders</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">Review order status and delivery progress.</p>
          <Link href="/orders" className={cn(NEU.button, "mt-4 inline-block")}>
            Track My Orders
          </Link>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Support</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">Contact MacroBox or read ordering information.</p>
          <Link href="/help" className={cn(NEU.button, "mt-4 inline-block")}>
            Open Help
          </Link>
        </article>
      </section>
    </PortalShell>
  );
}
