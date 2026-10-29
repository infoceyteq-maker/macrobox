"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import {
  sendCustomerPhoneOtpAction,
  verifyCustomerPhoneOtpAction,
} from "@/app/actions/customer-auth";
import { NEU, cn } from "@/components/ui/neu";
import { LEAD_CITIES } from "@/lib/pos/customer-auth";
import { notify } from "@/lib/ui/toast";

interface LeadRegistrationProps {
  /** Where to continue after the OTP is verified. Defaults to the menu. */
  nextPath?: string;
  /**
   * `quick` is the streamlined Quick Sign In surface: name + phone, optional
   * email, no delivery-city field, and continuation to the profile. Phone
   * ownership is still proven with an OTP in both variants.
   */
  variant?: "registration" | "quick";
}

const inputClass = cn(NEU.input, "px-5 py-4");
const labelClass = "ml-2 text-sm font-bold text-[#3d4a42]";

type Step = "details" | "otp";

/**
 * Customer lead registration: name + phone (+ optional email and delivery
 * city) first, then a Supabase SMS OTP. Verification auto-creates the
 * customer profile and continues to the digital menu. No password is ever
 * created; the optional email stays an unverified lead contact until the
 * customer confirms it later from My Profile.
 */
export default function LeadRegistration({
  nextPath = "/",
  variant = "registration",
}: LeadRegistrationProps) {
  const router = useRouter();
  const isQuick = variant === "quick";

  const [step, setStep] = useState<Step>("details");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [otpCode, setOtpCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);

  const [error, setError] = useState("");
  const [showDropdown, setShowDropdown] = useState(false);
  const [isPending, startTransition] = useTransition();

  const filteredCities = useMemo(
    () =>
      LEAD_CITIES.filter((city) =>
        city.toLowerCase().includes(location.trim().toLowerCase()),
      ),
    [location],
  );

  function handleSendOtp(event?: React.FormEvent<HTMLFormElement>) {
    event?.preventDefault();
    setError("");

    if (!name.trim()) {
      setError("Please enter your full name.");
      return;
    }
    if (!phone.trim()) {
      setError("Please enter your phone number for the verification code.");
      return;
    }

    startTransition(async () => {
      const result = await sendCustomerPhoneOtpAction({
        phone,
        name: name.trim(),
        email: email.trim(),
        location: location.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        notify.error("Verification code not sent", result.error);
        return;
      }
      setPhone(result.data.phone);
      setDevOtp(result.data.devOtp ?? null);
      setStep("otp");
      notify.success("Code sent", "Check your phone for the verification code.");
    });
  }

  function handleVerifyOtp(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");

    startTransition(async () => {
      const result = await verifyCustomerPhoneOtpAction({
        phone,
        token: otpCode,
        name: name.trim(),
        email: email.trim(),
        location: location.trim(),
      });
      if (!result.ok) {
        setError(result.error);
        notify.error("Verification failed", result.error);
        return;
      }
      notify.success("Welcome to MacroBox", "Your phone number is verified.");
      const target = nextPath.startsWith("/") ? nextPath : "/";
      router.replace(target);
      router.refresh();
    });
  }

  return (
    <main className={cn(NEU.page, "flex items-center justify-center px-4 py-10 sm:px-8")}>
      <div className={cn(NEU.card, "w-full max-w-lg p-7 sm:p-10")}>
        <div className="mb-10 text-center">
          <Image
            src="/macrobox_primary_cutout.png"
            alt="MacroBox"
            width={220}
            height={80}
            priority
            className="mx-auto h-auto w-[200px] object-contain"
          />
          <p className="mt-4 text-sm font-medium text-[#59645e]">
            {isQuick ? "Quick Sign In" : "Premium Healthy Diet Delivery"}
          </p>
        </div>

        {error ? (
          <div
            className="mb-6 rounded-2xl bg-[#f7e2de] px-4 py-3 text-center text-sm text-[#8a3b2f]"
            role="alert"
          >
            {error}
          </div>
        ) : null}

        {step === "details" ? (
          <form onSubmit={handleSendOtp} className="flex flex-col gap-6">
            <div className="flex flex-col gap-2">
              <label htmlFor="lead-name" className={labelClass}>
                Full Name
              </label>
              <input
                id="lead-name"
                type="text"
                autoComplete="name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="John Doe"
                className={inputClass}
                required
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="lead-email" className={labelClass}>
                Email Address <span className="font-medium text-[#7b857f]">(optional)</span>
              </label>
              <input
                id="lead-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="john@example.com"
                className={inputClass}
              />
              <span className="ml-2 text-xs text-[#7b857f]">
                For e-bills. You can confirm it later in My Profile.
              </span>
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="lead-phone" className={labelClass}>
                Phone Number (For OTP)
              </label>
              <input
                id="lead-phone"
                type="tel"
                inputMode="tel"
                autoComplete="tel"
                value={phone}
                onChange={(event) => setPhone(event.target.value)}
                placeholder="+94 77 123 4567"
                className={inputClass}
                required
              />
              <span className="ml-2 text-xs text-[#7b857f]">
                Include your country code. We send a one-time code by SMS — no password needed.
              </span>
            </div>

{!isQuick ? (
            <div className="relative flex flex-col gap-2">
              <label htmlFor="lead-location" className={labelClass}>
                Delivery Location <span className="font-medium text-[#7b857f]">(optional)</span>
              </label>
              <input
                id="lead-location"
                type="text"
                autoComplete="address-level2"
                value={location}
                onChange={(event) => {
                  setLocation(event.target.value);
                  setShowDropdown(true);
                }}
                onFocus={() => setShowDropdown(true)}
                onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
                onKeyDown={(event) => {
                  if (event.key === "Escape") setShowDropdown(false);
                }}
                placeholder="Type your city (e.g., Kandy)"
                className={inputClass}
                aria-expanded={showDropdown && filteredCities.length > 0}
                aria-controls="lead-city-list"
              />

              {showDropdown && filteredCities.length > 0 ? (
                <ul
                  id="lead-city-list"
                  className={cn(
                    NEU.cardSmall,
                    "absolute left-0 right-0 top-full z-10 mt-2 max-h-48 overflow-y-auto p-2",
                  )}
                >
                  {filteredCities.map((city) => (
                    <li key={city}>
                      <button
                        type="button"
                        onMouseDown={(event) => event.preventDefault()}
                        onClick={() => {
                          setLocation(city);
                          setShowDropdown(false);
                        }}
                        className="w-full rounded-xl px-4 py-3 text-left font-medium text-[#2E3033] transition-colors hover:bg-[#F7F6F2]"
                      >
                        {city}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </div>

            ) : null}

            <button
              type="submit"
              disabled={isPending}
              className={cn(NEU.buttonPrimary, "mt-2 w-full py-4")}
            >
              {isPending ? "Processing..." : isQuick ? "Login Now" : "Get Started"}
            </button>

            <p className="text-center text-xs font-semibold text-[#5f7b64]">
              Already registered?{" "}
              <Link href="/customer/login" className="hover:underline">
                Sign in with your phone
              </Link>
            </p>
          </form>
        ) : (
          <form onSubmit={handleVerifyOtp} className="flex flex-col gap-6">
            <div className="text-center text-[#2E3033]">
              <p>
                We&apos;ve sent a secure code to <strong>{phone}</strong>
              </p>
            </div>

            <input
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              value={otpCode}
              onChange={(event) =>
                setOtpCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              placeholder="6-digit code"
              className={cn(inputClass, "text-center font-mono text-2xl tracking-[0.5em]")}
              aria-label="6-digit verification code"
              required
            />

            {devOtp ? (
              <div className={cn(NEU.insetTiny, "px-4 py-3 text-center text-xs text-[#3f6b45]")}>
                Local preview code: <span className="font-bold">{devOtp}</span>
              </div>
            ) : null}

            <button
              type="submit"
              disabled={isPending || otpCode.length !== 6}
              className={cn(NEU.buttonPrimary, "mt-2 w-full py-4")}
            >
              {isPending ? "Verifying..." : isQuick ? "Verify & Go to Profile" : "Verify & Enter Menu"}
            </button>

            <div className="flex flex-wrap items-center justify-between gap-3 text-sm font-bold text-[#5f7b64]">
              <button
                type="button"
                onClick={() => {
                  setStep("details");
                  setOtpCode("");
                  setDevOtp(null);
                  setError("");
                }}
                disabled={isPending}
                className="transition-colors hover:text-[#2E3033]"
              >
                Change Phone Number
              </button>
              <button
                type="button"
                onClick={() => handleSendOtp()}
                disabled={isPending}
                className="transition-colors hover:text-[#2E3033]"
              >
                Resend code
              </button>
            </div>
          </form>
        )}

        <div className="mt-8 text-center text-xs font-semibold text-[#5f7b64]">
          <Link href="/" className="hover:underline">
            Back to digital menu
          </Link>
        </div>
      </div>
    </main>
  );
}
