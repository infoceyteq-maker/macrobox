"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  sendCustomerEmailOtpAction,
  verifyCustomerEmailOtpAction,
} from "@/app/actions/customer-auth";
import { NEU, cn } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";

interface CustomerEmailOtpFormProps {
  nextPath?: string;
}

const inputClass = cn(NEU.input, "px-5 py-4");

type Step = "email" | "otp";

/**
 * Alternative passwordless customer sign-in: email OTP code. Mirrors the
 * phone flow (`/customer/login`) for customers who prefer email; both end
 * at the same auto-created customer profile.
 */
export default function CustomerEmailOtpForm({
  nextPath = "/profile",
}: CustomerEmailOtpFormProps) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("email");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [isPending, startTransition] = useTransition();

  function handleSendEmailOtp(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await sendCustomerEmailOtpAction({ email: email.trim() });
      if (!result.ok) {
        setError(result.error);
        notify.error("Email code not sent", result.error);
        return;
      }
      setEmail(result.data.email);
      setDevOtp(result.data.devOtp ?? null);
      setStep("otp");
      notify.success("Code sent", "Check your email for the verification code.");
    });
  }

  function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await verifyCustomerEmailOtpAction({
        email: email.trim(),
        token: otp,
      });
      if (!result.ok) {
        setError(result.error);
        notify.error("Verification failed", result.error);
        return;
      }
      notify.success("Welcome to MacroBox", "Your email is verified.");
      const target = nextPath.startsWith("/") ? nextPath : "/profile";
      router.replace(target);
      router.refresh();
    });
  }

  return (
    <main className={cn(NEU.page, "flex items-center justify-center px-4 py-10 sm:px-8")}>
      <div className={cn(NEU.card, "w-full max-w-md p-7 sm:p-10")}>
        <div className="mb-8 text-center">
          <Image
            src="/macrobox_primary_cutout.png"
            alt="MacroBox"
            width={220}
            height={80}
            priority
            className="mx-auto h-auto w-[200px] object-contain"
          />
          <p className="mt-4 text-sm font-medium text-[#59645e]">
            {step === "email"
              ? "Sign in securely with your Email"
              : "Enter the code sent to your email"}
          </p>
        </div>

        {error ? (
          <div
            className="mb-4 rounded-xl bg-[#f7e2de] px-4 py-3 text-center text-sm font-semibold text-[#8a3b2f]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {step === "email" ? (
          <form onSubmit={handleSendEmailOtp} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="email-otp-email" className="ml-2 text-sm font-bold text-[#3d4a42]">
                Email Address
              </label>
              <input
                id="email-otp-email"
                type="email"
                autoComplete="email"
                placeholder="Enter your email (e.g. john@gmail.com)"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                className={inputClass}
                required
              />
            </div>
            <button
              disabled={isPending || !email.trim()}
              className={cn(NEU.buttonPrimary, "py-4")}
            >
              {isPending ? "Sending OTP..." : "Get Email OTP"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
            <div className="text-center text-sm text-[#2E3033]">
              Code sent to: <span className="font-bold">{email}</span>
            </div>
            <div className="flex flex-col gap-2">
              <input
                type="text"
                inputMode="numeric"
                autoComplete="one-time-code"
                placeholder="Email code"
                value={otp}
                onChange={(event) =>
                  setOtp(event.target.value.replace(/\D/g, "").slice(0, 8))
                }
                className={cn(inputClass, "text-center font-mono text-xl tracking-[0.5em]")}
                aria-label="Email verification code"
                required
              />
              <span className="text-center text-xs text-[#7b857f]">
                Enter the 6–8 digit code from your email. The same email also
                contains a sign-in link you can tap instead.
              </span>
            </div>

            {devOtp ? (
              <div className={cn(NEU.insetTiny, "px-4 py-3 text-center text-xs text-[#3f6b45]")}>
                Local preview code: <span className="font-bold">{devOtp}</span>
              </div>
            ) : null}

            <button
              disabled={isPending || otp.length < 6}
              className={cn(NEU.buttonPrimary, "py-4")}
            >
              {isPending ? "Verifying..." : "Verify & Sign In"}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#5f7b64]">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setOtp("");
                  setDevOtp(null);
                  setError("");
                }}
                disabled={isPending}
                className="transition-colors hover:text-[#2E3033]"
              >
                Change Email Address
              </button>
              <button
                type="button"
                onClick={() => handleSendEmailOtp()}
                disabled={isPending}
                className="transition-colors hover:text-[#2E3033]"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-semibold text-[#5f7b64]">
          <Link href="/customer/login" className="hover:underline">
            Sign in with phone instead
          </Link>
          <Link href="/" className="hover:underline">
            Back to digital menu
          </Link>
          <Link href="/orders" className="hover:underline">
            Track my orders
          </Link>
        </div>
      </div>
    </main>
  );
}
