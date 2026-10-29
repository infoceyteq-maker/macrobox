"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

import { getCurrentActorAction } from "@/app/actions/pos";
import { useCart } from "@/components/cart/cart-context";
import { CUSTOMER_CONTACT } from "@/lib/brand";
import type { AppUserRow } from "@/lib/pos/types";
import { cn, NEU } from "@/components/ui/neu";

const NAV_LINKS = [
  { href: "/", label: "Menu" },
  { href: "/cart", label: "Cart" },
  { href: "/orders", label: "Track My Orders" },
  { href: "/profile", label: "My Profile" },
] as const;

const SIDEBAR_ACCOUNT_LINKS = [
  { href: "/profile", label: "My Profile" },
  { href: "/settings", label: "Settings" },
  { href: "/help", label: "Help" },
  { href: "/loyalty", label: "Loyalty Program Benefits" },
  { href: "/information", label: "Information" },
] as const;

function initialsFor(name: string | null | undefined) {
  const parts = (name ?? "MacroBox Customer").trim().split(/\s+/).filter(Boolean);
  return (parts.slice(0, 2).map((part) => part[0]).join("") || "MB").toUpperCase();
}

export default function CustomerNavbar() {
  const pathname = usePathname();
  const { count } = useCart();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [customer, setCustomer] = useState<AppUserRow | null>(null);

  useEffect(() => {
    let active = true;
    getCurrentActorAction()
      .then((result) => {
        if (!active) return;
        setCustomer(result.ok && result.data.role === "CUSTOMER" ? result.data : null);
      })
      .catch(() => {
        if (active) setCustomer(null);
      });
    return () => {
      active = false;
    };
  }, [pathname]);

  useEffect(() => {
    setSidebarOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!sidebarOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setSidebarOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [sidebarOpen]);

  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);

  const navClass = (href: string) =>
    cn(
      NEU.button,
      "relative px-4 py-2.5 text-center text-sm",
      isActive(href) ? "bg-[#8FBC8F] text-[#22301f]" : "",
    );

  const sidebarLinkClass = (href: string) =>
    cn(
      "flex items-center justify-between gap-3 rounded-2xl px-4 py-3 text-sm font-semibold transition",
      isActive(href)
        ? "bg-[#8FBC8F] text-[#22301f] shadow-[5px_5px_11px_#a9b9a7,-5px_-5px_11px_#ffffff]"
        : "bg-[#F7F6F2]/70 text-[#3d4a42] shadow-[4px_4px_9px_#c6d0c2,-4px_-4px_9px_#ffffff] hover:bg-[#F7F6F2]",
    );

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-white/60 bg-[#DCE6DA]/95 shadow-[0_10px_28px_rgba(126,145,120,0.16)] backdrop-blur">
        <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex min-h-[76px] items-center gap-3 py-3">
            <button
              type="button"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open customer menu"
              aria-expanded={sidebarOpen}
              aria-controls="customer-sidebar"
              className={cn(
                NEU.button,
                "flex h-11 w-11 shrink-0 items-center justify-center !px-0 !py-0 text-xl leading-none",
              )}
            >
              <span aria-hidden="true">☰</span>
            </button>

            <Link href="/" className="flex min-w-0 items-center gap-3" aria-label="MacroBox home">
              <span className="relative h-12 w-40 shrink-0 sm:w-48">
                <Image
                  src="/macrobox_primary_cutout.png"
                  alt="MacroBox"
                  fill
                  priority
                  sizes="(max-width: 640px) 160px, 192px"
                  className="object-contain object-left"
                />
              </span>
            </Link>

            <nav aria-label="Customer" className="ml-auto hidden items-center gap-2 md:flex">
              {NAV_LINKS.map((item) => (
                <Link key={item.href} href={item.href} className={navClass(item.href)}>
                  {item.label}
                  {item.href === "/cart" && count > 0 ? (
                    <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2E3033] px-1 text-[11px] font-bold text-white shadow">
                      {count}
                    </span>
                  ) : null}
                </Link>
              ))}
              <Link href="/customer/login" className={cn(NEU.buttonPrimary, "px-4 py-2.5 text-center text-sm")}>
                Sign In
              </Link>
            </nav>

            <Link
              href="/customer/login"
              className={cn(NEU.buttonPrimary, "ml-auto px-4 py-2.5 text-center text-sm md:hidden")}
            >
              Sign In
            </Link>
          </div>

          <nav aria-label="Customer mobile" className="flex gap-2 overflow-x-auto pb-3 lg:hidden">
            {NAV_LINKS.map((item) => (
              <Link key={item.href} href={item.href} className={cn(navClass(item.href), "relative shrink-0")}>
                {item.label}
                {item.href === "/cart" && count > 0 ? (
                  <span className="absolute -right-1.5 -top-1.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-[#2E3033] px-1 text-[11px] font-bold text-white shadow">
                    {count}
                  </span>
                ) : null}
              </Link>
            ))}
          </nav>
        </div>
      </header>

      {sidebarOpen ? (
        <div className="fixed inset-0 z-[80]" role="presentation">
          <button
            type="button"
            aria-label="Close customer menu"
            onClick={() => setSidebarOpen(false)}
            className="absolute inset-0 h-full w-full cursor-default bg-[#2E3033]/30 backdrop-blur-[2px]"
          />
          <aside
            id="customer-sidebar"
            role="dialog"
            aria-modal="true"
            aria-label="Customer menu"
            className="absolute inset-y-0 left-0 flex w-[88vw] max-w-sm flex-col overflow-y-auto bg-[#DCE6DA] p-5 shadow-[18px_0_45px_rgba(46,48,51,0.25)]"
          >
            <div className="flex items-start justify-between gap-3">
              <Link href="/" className="relative h-12 w-44" aria-label="MacroBox home">
                <Image
                  src="/macrobox_primary_cutout.png"
                  alt="MacroBox"
                  fill
                  sizes="176px"
                  className="object-contain object-left"
                />
              </Link>
              <button
                type="button"
                onClick={() => setSidebarOpen(false)}
                className={cn(NEU.button, "h-10 w-10 shrink-0 !px-0 !py-0 text-lg")}
                aria-label="Close customer menu"
              >
                ×
              </button>
            </div>

            <Link
              href="/profile"
              className={cn(NEU.cardSmall, "mt-6 flex items-center gap-4 p-4")}
              aria-label="Open my profile"
            >
              <span
                role="img"
                aria-label="Profile image"
                className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-[#8FBC8F] font-display text-lg font-bold text-[#22301f] shadow-[5px_5px_11px_#a9b9a7,-5px_-5px_11px_#ffffff]"
              >
                {initialsFor(customer?.name)}
              </span>
              <span className="min-w-0">
                <span className="block truncate font-display text-base font-bold">
                  {customer?.name ?? "Guest customer"}
                </span>
                <span className="mt-1 block text-[11px] font-semibold uppercase tracking-wider text-[#527a58]">
                  Email
                </span>
                <span className="block break-all text-xs leading-5 text-[#5f6d65]">
                  {customer?.email ?? "Email not linked"}
                </span>
                <span className="block text-xs leading-5 text-[#5f6d65]">
                  {customer?.phone ?? "Sign in to view your profile"}
                </span>
              </span>
            </Link>

            {!customer ? (
              <div className="mt-4 grid grid-cols-2 gap-2">
                <Link href="/customer/login" className={cn(NEU.buttonPrimary, "text-center")}>
                  Sign In
                </Link>
                <Link href="/customer/register" className={cn(NEU.button, "text-center")}>
                  Register
                </Link>
              </div>
            ) : null}

            <nav aria-label="Browse MacroBox" className="mt-7">
              <p className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6f7a74]">Browse</p>
              <div className="mt-3 grid gap-2">
                {NAV_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className={sidebarLinkClass(item.href)}>
                    <span>{item.label}</span>
                    {item.href === "/cart" && count > 0 ? (
                      <span className="rounded-full bg-[#2E3033] px-2 py-0.5 text-[11px] font-bold text-white">
                        {count}
                      </span>
                    ) : (
                      <span aria-hidden="true">→</span>
                    )}
                  </Link>
                ))}
              </div>
            </nav>

            <nav aria-label="Customer account" className="mt-7">
              <p className="px-1 text-[11px] font-bold uppercase tracking-[0.22em] text-[#6f7a74]">Account</p>
              <div className="mt-3 grid gap-2">
                {SIDEBAR_ACCOUNT_LINKS.map((item) => (
                  <Link key={item.href} href={item.href} className={sidebarLinkClass(item.href)}>
                    <span>{item.label}</span>
                    <span aria-hidden="true">→</span>
                  </Link>
                ))}
              </div>
            </nav>

            <div className={cn(NEU.inset, "mt-auto px-4 py-4 pt-4 text-sm")}>
              <p className="font-display font-bold">Need help ordering?</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <a href={CUSTOMER_CONTACT.phoneHref} className={cn(NEU.buttonPrimary, "px-3 py-2 text-xs")}>
                  Call {CUSTOMER_CONTACT.phoneDisplay}
                </a>
                <a href={CUSTOMER_CONTACT.emailHref} className={cn(NEU.button, "px-3 py-2 text-xs")}>
                  Email us
                </a>
              </div>
            </div>
          </aside>
        </div>
      ) : null}
    </>
  );
}
