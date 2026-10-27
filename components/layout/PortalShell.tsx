"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { cn, NEU } from "@/components/ui/neu";

const NAV = [
  { href: "/", label: "Menu" },
  { href: "/cart", label: "Cart" },
  { href: "/orders", label: "Track" },
  { href: "/profile", label: "Profile" },
  { href: "/customer/login", label: "Sign in" },
];

interface PortalShellProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
}

/** Shared branded layout for customer, billing, and admin-adjacent screens. */
export default function PortalShell({ title, subtitle, actions, children }: PortalShellProps) {
  const pathname = usePathname();

  return (
    <main className={cn(NEU.page, "px-4 py-6 sm:px-8")}>
      <div className="mx-auto max-w-6xl space-y-6">
        <header className={cn(NEU.card, "flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6")}>
          <div className="flex items-center gap-4">
            <Image
              src="/macrobox_primary_cutout.png"
              alt="MacroBox"
              width={180}
              height={68}
              priority
              className="h-auto w-[150px] object-contain sm:w-[180px]"
            />
            <div>
              <h1 className="font-display text-xl font-bold tracking-tight sm:text-2xl">{title}</h1>
              {subtitle ? <p className="mt-1 text-xs text-[#6f7a74]">{subtitle}</p> : null}
            </div>
          </div>
          {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
        </header>

        <nav className={cn(NEU.cardSmall, "flex gap-1 overflow-x-auto p-2")} aria-label="MacroBox sections">
          {NAV.map((item) => {
            const active = pathname === item.href || (item.href !== "/" && pathname.startsWith(`${item.href}/`));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "whitespace-nowrap rounded-2xl px-4 py-2.5 text-xs font-semibold transition sm:text-sm",
                  active
                    ? "bg-[#8FBC8F] text-[#22301f] shadow-[inset_4px_4px_8px_#7ba47d,inset_-4px_-4px_8px_#a4d4a1]"
                    : "text-[#6f7a74] hover:bg-[#e4ece1] hover:text-[#3f6b45]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        {children}

        <footer className="pb-4 text-center text-xs text-[#7b857f]">
          MacroBox · Sage / Cream / Charcoal Soft UI · Cash on Delivery
        </footer>
      </div>
    </main>
  );
}
