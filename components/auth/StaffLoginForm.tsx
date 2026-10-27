"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { signInAction, signOutAction } from "@/app/actions/auth";
import { getCurrentActorAction } from "@/app/actions/pos";
import { NEU, cn } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import type { AppRole } from "@/lib/pos/types";

export type StaffPortal = "admin" | "driver" | "frontdesk" | "general";

interface StaffLoginFormProps {
  portal: StaffPortal;
  title: string;
  subtitle: string;
  nextPath: string;
  allowedRoles?: AppRole[];
}

const PORTAL_BADGE: Record<StaffPortal, string> = {
  admin: "MASTER ADMIN",
  driver: "DRIVER PORTAL",
  frontdesk: "FRONT DESK / POS",
  general: "EMPLOYEE PORTAL",
};

const inputClass = cn(NEU.input, "px-5 py-4");

export default function StaffLoginForm({
  portal,
  title,
  subtitle,
  nextPath,
  allowedRoles,
}: StaffLoginFormProps) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        notify.error("Sign-in failed", result.error);
        return;
      }

      if (allowedRoles) {
        const actor = await getCurrentActorAction();
        if (!actor.ok || !allowedRoles.includes(actor.data.role)) {
          await signOutAction();
          const denied = "This account is not authorized for this portal.";
          setError(denied);
          notify.error("Access denied", denied);
          return;
        }
      }

      setMessage("Signed in. Opening your workspace…");
      notify.success("Signed in", `Welcome to the ${title}.`);
      router.replace(nextPath.startsWith("/") ? nextPath : "/pos");
      router.refresh();
    });
  }

  return (
    <main className={cn(NEU.page, "px-4 py-6 sm:px-8")}>
      <div className="mx-auto grid max-w-5xl overflow-hidden rounded-[2rem] lg:grid-cols-[0.9fr_1.1fr] lg:shadow-[14px_14px_28px_#b7c4b5,-14px_-14px_28px_#ffffff]">
        <section className={cn(NEU.card, "flex flex-col justify-between gap-10 !rounded-none !border-0 !shadow-none p-8 sm:p-12")}>
          <div className="space-y-9">
            <Image
              src="/macrobox_primary_cutout.png"
              alt="MacroBox"
              width={220}
              height={80}
              priority
              className="h-auto w-[190px] object-contain"
            />
            <div className="space-y-5">
              <span className={NEU.badge}>{PORTAL_BADGE[portal]}</span>
              <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
                {title}
              </h1>
              <p className="max-w-md text-sm leading-7 text-[#59645e]">{subtitle}</p>
              <div className={cn(NEU.inset, "max-w-md px-5 py-4 text-sm leading-6 text-[#59645e]")}>
                Role permissions are enforced in Supabase. This page is for
                pre-provisioned employees only — there is no Admin or staff
                self-registration.
              </div>
            </div>
          </div>
          <p className="text-xs text-[#6f7a74]">
            Customer registration is separate at{" "}
            <Link href="/customer/register" className="font-semibold text-[#3f6b45] hover:underline">
              /customer/register
            </Link>
            .
          </p>
        </section>

        <section className="m-0 rounded-none bg-[#F7F6F2] p-7 shadow-[inset_8px_8px_18px_#d7ddd4,inset_-8px_-8px_18px_#ffffff] sm:p-11">
          <div className="mx-auto max-w-lg">
            <h2 className="font-display text-2xl font-bold">Authorized sign in</h2>
            <p className="mt-2 text-sm text-[#66716b]">
              Use the staff email and password issued by MacroBox administration.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="admin@macrobox.com"
                  className={inputClass}
                  required
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Password</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="••••••••"
                  className={inputClass}
                  required
                />
              </label>

              {error ? (
                <div className="rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm text-[#8a3b2f]" role="alert">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-2xl bg-[#e2eddf] px-4 py-3 text-sm text-[#3f6b45]">
                  {message}
                </div>
              ) : null}

              <button
                type="submit"
                disabled={isPending}
                className={cn(NEU.buttonPrimary, "w-full py-4")}
              >
                {isPending ? "Checking credentials…" : "Sign in securely"}
              </button>
            </form>

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#5f7b64]">
              <Link href="/" className="hover:underline">
                Digital menu
              </Link>
              <Link href="/customer/login" className="hover:underline">
                Customer sign in
              </Link>
              <Link href="/admin/login" className="hover:underline">
                Master Admin
              </Link>
              <Link href="/driver/login" className="hover:underline">
                Driver
              </Link>
              <Link href="/frontdesk/login?next=/pos" className="hover:underline">
                Front Desk
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
