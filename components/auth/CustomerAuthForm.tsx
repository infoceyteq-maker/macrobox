"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  linkCustomerGoogleAction,
  sendCustomerPhoneOtpAction,
  verifyCustomerPhoneOtpAction,
} from "@/app/actions/customer-auth";
import { sendCustomerEmailLinkAction } from "@/app/actions/customer-profile";
import { NEU, cn } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";

interface CustomerAuthFormProps {
  nextPath?: string;
}

const inputClass = cn(NEU.input, "px-5 py-4");

type Phase = "phone" | "verify" | "link";

/** Inline Google "G" mark (no external hotlinked asset). */
function GoogleIcon() {
  return (
    <svg viewBox="0 0 48 48" className="h-6 w-6" aria-hidden="true">
      <path
        fill="#FFC107"
        d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"
      />
      <path
        fill="#FF3D00"
        d="m6.3 14.7 6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"
      />
      <path
        fill="#4CAF50"
        d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"
      />
      <path
        fill="#1976D2"
        d="M43.6 20.1H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"
      />
    </svg>
  );
}

export default function CustomerAuthForm({
  nextPath = "/profile",
}: CustomerAuthFormProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("phone");
  const [phone, setPhone] = useState("");
  const [token, setToken] = useState("");
  const [email, setEmail] = useState("");
  const [emailSent, setEmailSent] = useState(false);
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

      // Phone identity is confirmed and the profile exists. Offer the
      // optional email/Google linking step before continuing to the profile.
      setMessage(
        "Phone verified. You can optionally link your email or Google, or skip.",
      );
      notify.success("Welcome to MacroBox", "Your phone number is verified.");
      setPhase("link");
    });
  }

  function destination() {
    const target = nextPath.startsWith("/") ? nextPath : "/profile";
    return target === "/profile"
      ? "/profile"
      : `/profile?next=${encodeURIComponent(target)}`;
  }

  function linkGoogle() {
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await linkCustomerGoogleAction({ next: destination() });
      if (!result.ok) {
        setError(result.error);
        notify.error("Google linking unavailable", result.error);
        return;
      }
      // Hand off to Google; /auth/callback completes the link and returns
      // the customer to their profile with the session refreshed.
      window.location.assign(result.data.url);
    });
  }

  function continueToProfile() {
    router.replace(destination());
    router.refresh();
  }

  function linkEmail(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Enter an email address first.");
      return;
    }

    startTransition(async () => {
      const result = await sendCustomerEmailLinkAction({ email: email.trim() });
      if (!result.ok) {
        setError(result.error);
        notify.error("Email link not sent", result.error);
        return;
      }
      setEmailSent(true);
      setMessage(
        `Verification link sent to ${email.trim()}. Confirm it from your inbox to finish linking — you can also continue now.`,
      );
      notify.success("Email link sent", "Check your inbox to confirm the address.");
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
              After phone verification you can link an email or Google in one
              optional step, or add an email later in My Profile for e-bills
              and magic-link sign-in. It is not required to place an order.
            </p>
          </div>
        </section>

        <section className={cn(NEU.card, "p-6 sm:p-9")}>
          <div className="mx-auto max-w-xl">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">
              {phase === "link"
                ? "Optional step"
                : `Step ${phase === "phone" ? "1" : "2"} of 2`}
            </p>
            <h2 className="mt-3 font-display text-2xl font-bold">
              {phase === "phone"
                ? "Continue with your phone"
                : phase === "verify"
                  ? "Enter your SMS code"
                  : "(Optional) Link your Email for easier access"}
            </h2>
            <p className="mt-2 text-sm text-[#6f7a74]">
              {phase === "phone"
                ? "We will send a one-time code. New customers are created automatically."
                : phase === "verify"
                  ? `We sent a 6-digit code to ${phone}.`
                  : "Add an email for e-bills and magic-link sign-in, or connect Google. Both are optional — you can skip this and do it later in My Profile."}
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
            ) : phase === "verify" ? (
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
            ) : (
              <div className="mt-6 space-y-4">
                {message ? (
                  <div className="rounded-2xl bg-[#e2eddf] px-4 py-3 text-sm text-[#3f6b45]">
                    {message}
                  </div>
                ) : null}
                {error ? (
                  <div className="rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm text-[#8a3b2f]" role="alert">
                    {error}
                  </div>
                ) : null}

                <form onSubmit={linkEmail} className="space-y-4">
                  <label className="block space-y-2 text-sm font-medium">
                    <span>Email address</span>
                    <input
                      type="email"
                      autoComplete="email"
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      placeholder="your@email.com"
                      className={inputClass}
                      required
                    />
                  </label>
                  <button
                    type="submit"
                    disabled={isPending || !email.trim()}
                    className={cn(NEU.buttonPrimary, "w-full py-4")}
                  >
                    {isPending ? "Linking..." : "Link Email & Continue"}
                  </button>
                </form>

                {emailSent ? (
                  <button
                    type="button"
                    onClick={continueToProfile}
                    disabled={isPending}
                    className={cn(NEU.button, "w-full py-4 font-bold")}
                  >
                    Continue to Profile
                  </button>
                ) : null}

                <div className="flex items-center gap-3 text-xs font-semibold text-[#7b857f]">
                  <span className={cn(NEU.insetTiny, "h-px flex-1")} />
                  or connect with Google
                  <span className={cn(NEU.insetTiny, "h-px flex-1")} />
                </div>

                <button
                  type="button"
                  onClick={linkGoogle}
                  disabled={isPending}
                  className={cn(
                    NEU.button,
                    "flex w-full items-center justify-center gap-3 py-4 font-bold",
                  )}
                >
                  <GoogleIcon />
                  {isPending ? "Connecting…" : "Connect Automatically with Gmail"}
                </button>

                <button
                  type="button"
                  onClick={continueToProfile}
                  disabled={isPending}
                  className="w-full text-center text-sm font-bold text-[#5f7b64] transition-colors hover:text-[#2E3033] disabled:opacity-55"
                >
                  Skip &amp; Go to Profile
                </button>

                <p className="text-center text-xs leading-5 text-[#7b857f]">
                  Linking an email or Google is optional and never replaces
                  your phone sign-in — you can always continue with the SMS code.
                </p>
              </div>
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
