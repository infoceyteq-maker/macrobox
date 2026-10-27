"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  registerCustomerAction,
  signInCustomerAction,
} from "@/app/actions/customer-auth";
import { NEU, cn } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";

type AuthMode = "signin" | "register";

interface CustomerAuthFormProps {
  initialMode?: AuthMode;
  nextPath?: string;
}

const inputClass = cn(NEU.input, "px-5 py-4");

export default function CustomerAuthForm({
  initialMode = "signin",
  nextPath = "/orders",
}: CustomerAuthFormProps) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(initialMode);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function switchMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === "register" && password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    startTransition(async () => {
      const result =
        mode === "register"
          ? await registerCustomerAction({ name, email, phone, password })
          : await signInCustomerAction({ identifier, password });

      if (!result.ok) {
        setError(result.error);
        notify.error(mode === "register" ? "Registration failed" : "Sign-in failed", result.error);
        return;
      }

      setMessage(mode === "register" ? "Account created. Opening your orders…" : "Signed in…");
      notify.success(
        mode === "register" ? "Welcome to MacroBox" : "Welcome back",
        "You can browse the menu, order, and track delivery.",
      );
      router.replace(nextPath.startsWith("/") ? nextPath : "/orders");
      router.refresh();
    });
  }

  return (
    <main className={cn(NEU.page, "px-4 py-6 sm:px-8")}>
      <div className="mx-auto grid max-w-5xl gap-6 lg:grid-cols-[0.85fr_1.15fr]">
        <section className={cn(NEU.card, "flex flex-col justify-between gap-10 p-7 sm:p-10")}>
          <div className="space-y-8">
            <Image
              src="/macrobox_primary_cutout.png"
              alt="MacroBox"
              width={220}
              height={80}
              priority
              className="h-auto w-[190px] object-contain"
            />
            <div className="space-y-4">
              <span className={NEU.badge}>CUSTOMER DIGITAL MENU</span>
              <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
                Order your
                <br />
                weekday meal.
              </h1>
              <p className="max-w-sm text-sm leading-7 text-[#59645e]">
                Create one account with your email and phone number, then sign in
                with either one. Browse meals, place a Cash-on-Delivery order,
                and follow its delivery status.
              </p>
            </div>
          </div>
          <div className={cn(NEU.inset, "space-y-2 px-5 py-4 text-xs leading-6 text-[#59645e]")}>
            <p className="font-semibold text-[#2E3033]">Separate portals</p>
            <p>
              Employees use the Master Admin, Front Desk, or Driver login. There
              is no Admin self-registration on this page.
            </p>
          </div>
        </section>

        <section className={cn(NEU.card, "p-6 sm:p-9")}>
          <div className="mx-auto max-w-xl">
            <div className={cn(NEU.cardSmall, "grid grid-cols-2 gap-1 p-1.5")}>
              <button
                type="button"
                onClick={() => switchMode("signin")}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  mode === "signin"
                    ? "bg-[#8FBC8F] text-[#22301f] shadow-[inset_4px_4px_8px_#7ba47d,inset_-4px_-4px_8px_#a4d4a1]"
                    : "text-[#6f7a74] hover:bg-[#e4ece1]",
                )}
              >
                Sign in
              </button>
              <button
                type="button"
                onClick={() => switchMode("register")}
                className={cn(
                  "rounded-2xl px-4 py-3 text-sm font-semibold transition",
                  mode === "register"
                    ? "bg-[#8FBC8F] text-[#22301f] shadow-[inset_4px_4px_8px_#7ba47d,inset_-4px_-4px_8px_#a4d4a1]"
                    : "text-[#6f7a74] hover:bg-[#e4ece1]",
                )}
              >
                Create account
              </button>
            </div>

            <h2 className="mt-7 font-display text-2xl font-bold">
              {mode === "register" ? "Register with email & phone" : "Sign in with email or phone"}
            </h2>
            <p className="mt-2 text-sm text-[#6f7a74]">
              {mode === "register"
                ? "Both identifiers are attached to one secure Supabase Auth account."
                : "Use the email address or international phone number you registered with."}
            </p>

            <form onSubmit={handleSubmit} className="mt-6 space-y-4">
              {mode === "register" ? (
                <>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Full name</span>
                    <input
                      autoComplete="name"
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Your name"
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Email address</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                    />
                  </label>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Phone number</span>
                    <input
                      type="tel"
                      autoComplete="tel"
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      placeholder="+94…"
                      className={inputClass}
                      required
                    />
                    <span className="block text-xs font-normal text-[#7b857f]">
                      Include your country code, e.g. +94… Spaces are accepted.
                    </span>
                  </label>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <label className="block space-y-2 text-sm font-medium">
                      <span>Password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={password}
                        onChange={(event) => setPassword(event.target.value)}
                        placeholder="10+ characters"
                        className={inputClass}
                        required
                      />
                    </label>
                    <label className="block space-y-2 text-sm font-medium">
                      <span>Confirm password</span>
                      <input
                        type="password"
                        autoComplete="new-password"
                        value={confirmPassword}
                        onChange={(event) => setConfirmPassword(event.target.value)}
                        placeholder="Repeat password"
                        className={inputClass}
                        required
                      />
                    </label>
                  </div>
                </>
              ) : (
                <>
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Email or phone number</span>
                    <input
                      autoComplete="username"
                      value={identifier}
                      onChange={(event) => setIdentifier(event.target.value)}
                      placeholder="you@example.com or +94…"
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
                      placeholder="Your password"
                      className={inputClass}
                      required
                    />
                  </label>
                </>
              )}

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
                {isPending
                  ? mode === "register"
                    ? "Creating account…"
                    : "Signing in…"
                  : mode === "register"
                    ? "Create customer account"
                    : "Sign in to menu"}
              </button>
            </form>

            <div className="mt-7 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#5f7b64]">
              <Link href="/" className="hover:underline">
                Back to digital menu
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
