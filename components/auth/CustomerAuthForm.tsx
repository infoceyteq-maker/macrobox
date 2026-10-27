"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  sendCustomerPhoneOtpAction,
  verifyCustomerPhoneOtpAction,
} from "@/app/actions/customer-auth";
import { NEU, cn } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";

interface CustomerAuthFormProps {
  nextPath?: string;
}

const inputClass = cn(NEU.input, "px-5 py-4");

type Phase = "phone" | "verify";

export default function CustomerAuthForm({
  nextPath = "/profile",
}: CustomerAuthFormProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function sendOtp(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError(null);
    setMessage(null);
    setDevOtp(null);

    startTransition(async () => {
      const result = await sendCustomerPhoneOtpAction({ phone });
      if (!result.ok) {
        setError(result.error);
        notify.error("Verification code not sent", result.error);
        return;
      }

      setPhone(result.data.phone);
      setDevOtp(result.data.devOtp ?? null);
      setPhase("verify");
      setMessage("We sent a 6-digit code by SMS. It expires shortly.");
      notify.success("Code sent", "Check your phone for the verification code.");
    });
  }

  function verifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await verifyCustomerPhoneOtpAction({ phone, token });
      if (!result.ok) {
        setError(result.error);
        notify.error("Verification failed", result.error);
        return;
      }

      setMessage("Phone verified. Opening your profile…");
      notify.success("Welcome to MacroBox", "Your phone number is verified.");
      const target = nextPath.startsWith("/") ? nextPath : "/profile";
      const profileTarget =
        target === "/profile"
          ? "/profile"
          : `/profile?next=${encodeURIComponent(target)}`;
      router.replace(profileTarget);
      router.refresh();
    });
  }

  function changePhone() {
    setPhase("phone");
    setToken("");
    setDevOtp(null);
    setError(null);
    setMessage(null);
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
                No passwords to remember. Enter your phone number, confirm the
                one-time code, and your customer profile is created automatically.
              </p>
            </div>
          </div>
          <div className={cn(NEU.inset, "space-y-2 px-5 py-4 text-xs leading-6 text-[#59645e]")}>
            <p className="font-semibold text-[#2E3033]">Optional email</p>
            <p>
              After sign-in you can add an email address in My Profile for
              e-bills and magic-link sign-in. It is not required to place an order.
            </p>
          </div>
        </section>

        <section className={cn(NEU.card, "p-6 sm:p-9")}>
          <div className="mx-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">
              Step {phase === "phone" ? "1" : "2"} of 2
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold">
              {phase === "phone" ? "Continue with your phone" : "Enter your SMS code"}
            </h2>
            <p className="mt-2 text-sm text-[#6f7a74]">
              {phase === "phone"
                ? "We will send a one-time code. New customers are created automatically."
                : `We sent a 6-digit code to ${phone}.`}
            </p>

            {phase === "phone" ? (
              <form onSubmit={sendOtp} className="mt-6 space-y-4">
                <label className="block space-y-2 text-sm font-medium">
                  <span>Phone number</span>
                  <input
                    type="tel"
                    inputMode="tel"
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

                {error ? (
                  <div className="rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm text-[#8a3b2f]" role="alert">
                    {error}
                  </div>
                ) : null}

                <button
                  type="submit"
                  disabled={isPending || !phone.trim()}
                  className={cn(NEU.buttonPrimary, "w-full py-4")}
                >
                  {isPending ? "Sending code…" : "Send verification code"}
                </button>
              </form>
            ) : (
              <form onSubmit={verifyOtp} className="mt-6 space-y-4">
                <label className="block space-y-2 text-sm font-medium">
                  <span>6-digit code</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    value={token}
                    onChange={(event) =>
                      setToken(event.target.value.replace(/\D/g, "").slice(0, 6))
                    }
                    placeholder="123456"
                    className={cn(inputClass, "text-center text-2xl tracking-[0.5em]")}
                    required
                  />
                </label>

                {devOtp ? (
                  <div className={cn(NEU.insetTiny, "px-4 py-3 text-xs text-[#3f6b45]")}>
                    Local preview code: <span className="font-bold">{devOtp}</span>
                  </div>
                ) : null}

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
                  disabled={isPending || token.length !== 6}
                  className={cn(NEU.buttonPrimary, "w-full py-4")}
                >
                  {isPending ? "Verifying…" : "Verify & continue"}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-xs font-semibold text-[#5f7b64]">
                  <button
                    type="button"
                    onClick={changePhone}
                    className="hover:underline"
                    disabled={isPending}
                  >
                    Change number
                  </button>
                  <button
                    type="button"
                    onClick={() => sendOtp()}
                    className="hover:underline"
                    disabled={isPending}
                  >
                    Resend code
                  </button>
                </div>
              </form>
            )}

            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#5f7b64]">
              <Link href="/" className="hover:underline">
                Back to digital menu
              </Link>
              <Link href="/orders" className="hover:underline">
                Track my orders
              </Link>
              <Link href="/profile" className="hover:underline">
                My Profile
              </Link>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
