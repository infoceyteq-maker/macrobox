import Link from "next/link";

import PortalShell from "@/components/layout/PortalShell";
import { cn, NEU } from "@/components/ui/neu";

export default function LoyaltyPage() {
  return (
    <PortalShell title="Loyalty Program Benefits" subtitle="MacroBox customer loyalty information">
      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <p className={NEU.badge}>Loyalty Program Benefits</p>
        <h2 className="mt-4 font-display text-2xl font-bold">Program details are being prepared</h2>
        <p className="mt-3 max-w-2xl text-sm leading-7 text-[#5f6d65]">
          Approved loyalty rewards, earning rules, and redemption details have not been published in the current
          MacroBox menu yet. When the program terms are confirmed, they will appear on this page without changing
          your account or order history.
        </p>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/profile" className={cn(NEU.buttonPrimary)}>
            My Profile
          </Link>
          <Link href="/" className={cn(NEU.button)}>
            Browse Menu
          </Link>
        </div>
      </section>
    </PortalShell>
  );
}
