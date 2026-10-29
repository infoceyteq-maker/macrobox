"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useCart } from "@/components/cart/cart-context";
import { cn } from "@/components/ui/neu";

/**
 * Public customer navigation. Internal Admin / Staff / POS / Driver links
 * are deliberately NOT included — only customer-relevant destinations.
 * Note: sign-in points to the passwordless customer flow (/customer/login);
 * /login is the employee sign-in and is never linked from public pages.
 */
const NAV = [
  { href: "/", label: "Menu", match: ["/", "/menu"] },
  { href: "/cart", label: "Cart", match: ["/cart"] },
  { href: "/orders", label: "Track My Orders", match: ["/orders", "/track"] },
  { href: "/profile", label: "My Profile", match: ["/profile"] },
] as const;

function linkClass(active: boolean) {
  return cn(
    "whitespace-nowrap rounded-full px-4 py-2 font-display text-sm font-semibold transition",
    active
      ? "bg-[#8FBC8F] text-[#22301f] shadow-[inset_4px_4px_8px_#7ba47d,inset_-4px_-4px_8px_#a4d4a1]"
      : "text-[#3d4a42] hover:bg-[#e4ece1] hover:text-[#2E3033]",
  );
}

export default function CustomerNavbar() {
  const pathname = usePathname();
  const { count } = useCart();

  const isActive = (match: readonly string[]) =>
    match.some((path) =>
      path === "/" ? pathname === "/" : pathname === path || pathname.startsWith(`${path}/`),
    );

  return (
    <nav
      className="sticky top-0 z-50 border-b border-white/60 bg-[#F7F6F2]/95 shadow-[0_10px_24px_rgba(46,48,51,0.12)] backdrop-blur"
      aria-label="Customer navigation"
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-8">
        <Link href="/" className="flex shrink-0 items-center" aria-label="MacroBox — back to menu">
          <Image
            src="/macrobox_primary_cutout.png"
            alt="MacroBox"
            width={180}
            height={68}
            priority
            className="h-10 w-auto object-contain sm:h-11"
          />
        </Link>

        <div className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link key={item.href} href={item.href} className={linkClass(isActive(item.match))}>
              {item.label}
              {item.href === "/cart" && count > 0 ? (
                <span className="ml-2 rounded-full bg-[#2E3033] px-2 py-0.5 text-xs font-bold text-[#F7F6F2]">
                  {count}
                </span>
              ) : null}
            </Link>
          ))}
        </div>

        <Link
          href="/customer/login"
          className="shrink-0 rounded-full bg-[#8FBC8F] px-5 py-2.5 font-display text-sm font-bold text-[#22301f] shadow-[5px_5px_12px_#c6d0c2,-5px_-5px_12px_#ffffff] transition hover:bg-[#7CA982]"
        >
          Sign In
        </Link>
      </div>

      {/* Mobile link row — same customer-only destinations, horizontally scrollable. */}
      <div className="flex gap-1 overflow-x-auto px-4 pb-3 md:hidden">
        {NAV.map((item) => (
          <Link key={item.href} href={item.href} className={linkClass(isActive(item.match))}>
            {item.label}
            {item.href === "/cart" && count > 0 ? (
              <span className="ml-2 rounded-full bg-[#2E3033] px-2 py-0.5 text-xs font-bold text-[#F7F6F2]">
                {count}
              </span>
            ) : null}
          </Link>
        ))}
      </div>
    </nav>
  );
}
