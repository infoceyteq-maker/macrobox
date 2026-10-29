import Link from "next/link";

import PortalShell from "@/components/layout/PortalShell";
import { CUSTOMER_CONTACT } from "@/lib/brand";
import { cn, NEU } from "@/components/ui/neu";

export default function HelpPage() {
  return (
    <PortalShell title="Help" subtitle="Ordering help and MacroBox contact options">
      <section className="grid gap-4 md:grid-cols-3">
        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Call to order</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">
            Prefer speaking to us? Call MacroBox to place your order by phone.
          </p>
          <a href={CUSTOMER_CONTACT.phoneHref} className={cn(NEU.buttonPrimary, "mt-4 inline-block")}>
            Call {CUSTOMER_CONTACT.phoneDisplay}
          </a>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">WhatsApp</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">Message us on the supplied MacroBox number.</p>
          <a
            href={CUSTOMER_CONTACT.whatsappHref}
            target="_blank"
            rel="noreferrer"
            className={cn(NEU.button, "mt-4 inline-block")}
          >
            Open WhatsApp
          </a>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Email</h2>
          <p className="mt-2 break-all text-sm leading-6 text-[#5f6d65]">{CUSTOMER_CONTACT.email}</p>
          <a href={CUSTOMER_CONTACT.emailHref} className={cn(NEU.button, "mt-4 inline-block")}>
            Email MacroBox
          </a>
        </article>
      </section>

      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <h2 className="font-display text-xl font-bold">How online ordering works</h2>
        <ol className="mt-4 grid gap-3 text-sm leading-6 text-[#46524b] md:grid-cols-4">
          <li className={cn(NEU.inset, "px-4 py-3")}>1. Choose today&apos;s combo or a weekday meal.</li>
          <li className={cn(NEU.inset, "px-4 py-3")}>2. Select Online Order to add it to your cart.</li>
          <li className={cn(NEU.inset, "px-4 py-3")}>3. Complete the Cash on Delivery checkout.</li>
          <li className={cn(NEU.inset, "px-4 py-3")}>4. Follow progress from Track My Orders.</li>
        </ol>
        <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/" className={cn(NEU.buttonPrimary)}>
            Browse Menu
          </Link>
          <Link href="/orders" className={cn(NEU.button)}>
            Track My Orders
          </Link>
        </div>
      </section>
    </PortalShell>
  );
}
