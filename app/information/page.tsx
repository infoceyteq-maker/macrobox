import Link from "next/link";

import PortalShell from "@/components/layout/PortalShell";
import { CUSTOMER_CONTACT } from "@/lib/brand";
import { cn, NEU } from "@/components/ui/neu";

export default function InformationPage() {
  return (
    <PortalShell title="Information" subtitle="About the MacroBox weekday lunch service">
      <section className="grid gap-4 md:grid-cols-2">
        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Weekday lunch menu</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">
            The customer menu presents the MacroBox Lunch (Rice &amp; Curry) selection for Monday through Friday.
            Open a meal to review its listed ingredients and macro values before ordering.
          </p>
          <Link href="/" className={cn(NEU.buttonPrimary, "mt-4 inline-block")}>
            View Menu
          </Link>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Ordering and payment</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">
            Add meals online and complete checkout with Cash on Delivery, or call MacroBox if you prefer to order
            by phone.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <Link href="/cart" className={cn(NEU.buttonPrimary)}>
              Online Order
            </Link>
            <a href={CUSTOMER_CONTACT.phoneHref} className={cn(NEU.button)}>
              Call {CUSTOMER_CONTACT.phoneDisplay}
            </a>
          </div>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Order tracking</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">
            Signed-in customers can follow order progress and open their digital e-bill from the tracking area.
          </p>
          <Link href="/orders" className={cn(NEU.button, "mt-4 inline-block")}>
            Track My Orders
          </Link>
        </article>

        <article className={cn(NEU.card, "p-5")}>
          <h2 className="font-display text-lg font-bold">Contact</h2>
          <p className="mt-2 text-sm leading-6 text-[#5f6d65]">
            WhatsApp: {CUSTOMER_CONTACT.phoneDisplay}
            <br />
            Email: {CUSTOMER_CONTACT.email}
          </p>
          <a href={CUSTOMER_CONTACT.emailHref} className={cn(NEU.button, "mt-4 inline-block")}>
            Email MacroBox
          </a>
        </article>
      </section>
    </PortalShell>
  );
}
