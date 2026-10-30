"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition, type FormEvent } from "react";
import {
  sendCustomerWhatsAppOtpAction,
  verifyCustomerWhatsAppOtpAction,
} from "@/app/actions/customer-auth";
import { WHATSAPP_OTP_LENGTH } from "@/lib/pos/customer-auth";
import { notify } from "@/lib/ui/toast";

const CUSTOMER_LINKS = [
  { href: "/", label: "Menu" },
  { href: "/cart", label: "Cart" },
  { href: "/orders", label: "Track Orders" },
  { href: "/profile", label: "Profile" },
] as const;

const neuPanel =
  "border border-white/[0.06] bg-[#101014] shadow-[22px_22px_44px_rgba(0,0,0,0.72),-12px_-12px_30px_rgba(255,255,255,0.045),inset_1px_1px_0_rgba(255,255,255,0.05)]";
const neuInset =
  "border border-black/70 bg-[#0B0B0E] shadow-[inset_7px_7px_14px_rgba(0,0,0,0.82),inset_-5px_-5px_12px_rgba(255,255,255,0.045)] focus:border-[#FACC15]/70 focus:shadow-[inset_7px_7px_14px_rgba(0,0,0,0.82),0_0_0_4px_rgba(250,204,21,0.14)]";
const neuButton =
  "shadow-[10px_10px_22px_rgba(0,0,0,0.62),-6px_-6px_16px_rgba(255,255,255,0.05),inset_1px_1px_0_rgba(255,255,255,0.22)] transition hover:-translate-y-0.5 active:translate-y-0 active:shadow-[inset_5px_5px_12px_rgba(0,0,0,0.28)]";

function WhatsAppMark() {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      className="h-5 w-5"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 11.5a8.5 8.5 0 0 1-12.4 7.5L3 21l2.1-5.4A8.5 8.5 0 1 1 21 11.5Z" />
      <path d="M9 9.8c.6 2.4 2.8 4.6 5.2 5.2l1.3-1.3 2.5 1.1c-.3 1.5-1.4 2.2-3 1.8C10.3 15.5 8.5 13.7 7.4 9c-.4-1.6.3-2.7 1.8-3L10.3 8.5 9 9.8Z" />
    </svg>
  );
}

export default function WhatsAppOtpLogin({ nextPath }: { nextPath: string }) {
  const router = useRouter();
  const [step, setStep] = useState<"phone" | "otp">("phone");
  const [phone, setPhone] = useState("+94 ");
  const [sentPhone, setSentPhone] = useState("");
  const [code, setCode] = useState("");
  const [devOtp, setDevOtp] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [isSending, startSending] = useTransition();
  const [isVerifying, startVerifying] = useTransition();
  const [isResending, startResending] = useTransition();

  const profileDestination =
    nextPath === "/profile" ? "/profile" : `/profile?next=${encodeURIComponent(nextPath)}`;

  function handleSend(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    startSending(async () => {
      const result = await sendCustomerWhatsAppOtpAction({ phone });
      if (!result.ok) {
        setError(result.error);
        notify.error("Could not send WhatsApp code", result.error);
        return;
      }

      setPhone(result.data.phone);
      setSentPhone(result.data.phone);
      setCode(result.data.devOtp ?? "");
      setDevOtp(result.data.devOtp ?? null);
      setStep("otp");
      setNotice(
        result.data.devOtp
          ? "Local preview code ready below. Production sends the code to WhatsApp."
          : `A ${WHATSAPP_OTP_LENGTH}-digit code is on its way to ${result.data.phone} on WhatsApp.`,
      );
      notify.success(
        "WhatsApp code sent",
        result.data.devOtp
          ? "Use the local preview code shown on this page."
          : "Enter the 6-digit code from WhatsApp to continue.",
      );
    });
  }

  function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setNotice("");

    startVerifying(async () => {
      const result = await verifyCustomerWhatsAppOtpAction({
        phone: sentPhone || phone,
        token: code,
      });
      if (!result.ok) {
        setError(result.error);
        notify.error("WhatsApp sign-in failed", result.error);
        return;
      }

      notify.success("Welcome to Baduma.sl", "Your profile is ready. You can add your name and delivery address anytime.");
      router.replace(profileDestination);
      router.refresh();
    });
  }

  function handleResend() {
    setError("");
    setNotice("");
    startResending(async () => {
      const result = await sendCustomerWhatsAppOtpAction({ phone: sentPhone || phone });
      if (!result.ok) {
        setError(result.error);
        notify.error("Could not resend code", result.error);
        return;
      }
      setCode(result.data.devOtp ?? "");
      setDevOtp(result.data.devOtp ?? null);
      setNotice(`A new WhatsApp code was sent to ${result.data.phone}.`);
      notify.success("New WhatsApp code sent", "Check WhatsApp for the latest 6-digit code.");
    });
  }

  function changeNumber() {
    setStep("phone");
    setCode("");
    setDevOtp(null);
    setError("");
    setNotice("");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#070709] font-sans text-[#F8F5EA]">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0"
        style={{
          backgroundImage:
            "radial-gradient(circle at 16% 12%, rgba(250,204,21,0.16), transparent 30rem), radial-gradient(circle at 86% 78%, rgba(255,215,0,0.10), transparent 28rem), linear-gradient(145deg, rgba(255,255,255,0.035), transparent 36%, rgba(0,0,0,0.55))",
        }}
      />
      <div className="relative mx-auto flex min-h-screen w-full max-w-7xl flex-col px-4 py-5 sm:px-6 lg:px-8">
        <header className="flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="group inline-flex items-center gap-3" aria-label="Baduma.sl menu">
            <span className={`flex h-12 w-12 items-center justify-center rounded-2xl text-xl font-black text-[#FACC15] ${neuPanel}`}>
              B
            </span>
            <span>
              <span className="block font-display text-xl font-bold tracking-tight text-white">
                Baduma<span className="text-[#FACC15]">.sl</span>
              </span>
              <span className="block text-[0.68rem] font-semibold uppercase tracking-[0.24em] text-white/45">
                MacroBox Kitchen
              </span>
            </span>
          </Link>

          <nav
            aria-label="Customer"
            className={`flex flex-wrap items-center gap-1 rounded-full p-1.5 ${neuPanel}`}
          >
            {CUSTOMER_LINKS.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={`rounded-full px-3.5 py-2 text-sm font-semibold transition hover:text-[#FACC15] sm:px-4 ${
                  item.label === "Profile"
                    ? "bg-[#FACC15] text-black shadow-[0_8px_20px_rgba(250,204,21,0.22)] hover:text-black"
                    : "text-white/68"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
        </header>

        <section className="grid flex-1 items-center gap-10 py-12 lg:grid-cols-[1.02fr_0.86fr] lg:py-16">
          <div className="max-w-2xl">
            <p className="inline-flex items-center gap-2 rounded-full border border-[#FACC15]/25 bg-[#FACC15]/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.22em] text-[#FACC15]">
              <WhatsAppMark />
              Password-less customer access
            </p>
            <h1 className="mt-7 font-display text-5xl font-bold leading-[0.98] tracking-tight text-white sm:text-6xl lg:text-7xl">
              Sign in with
              <span className="block text-[#FACC15]">WhatsApp.</span>
            </h1>
            <p className="mt-6 max-w-xl text-base leading-7 text-white/62 sm:text-lg sm:leading-8">
              No password. No long registration form. Enter your WhatsApp number,
              type the 6-digit code, and your customer profile is created
              automatically.
            </p>

            <div className="mt-9 grid gap-3 sm:grid-cols-3">
              {[
                ["01", "Add number", "Use +94 or your local Sri Lankan number."],
                ["02", "Enter code", "We send a secure 6-digit WhatsApp OTP."],
                ["03", "Complete later", "Add name and delivery address in Profile."],
              ].map(([number, title, text]) => (
                <article key={number} className={`rounded-3xl p-4 ${neuPanel}`}>
                  <p className="text-xs font-black tracking-[0.2em] text-[#FACC15]">{number}</p>
                  <h2 className="mt-3 font-display text-base font-bold text-white">{title}</h2>
                  <p className="mt-1.5 text-sm leading-6 text-white/52">{text}</p>
                </article>
              ))}
            </div>
          </div>

          <section className={`rounded-[2rem] p-5 sm:p-7 ${neuPanel}`} aria-labelledby="whatsapp-login-title">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#FACC15]">
                  Step {step === "phone" ? "1 of 2" : "2 of 2"}
                </p>
                <h2 id="whatsapp-login-title" className="mt-2 font-display text-3xl font-bold text-white">
                  {step === "phone" ? "Your WhatsApp number" : "Enter your code"}
                </h2>
              </div>
              <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-[#FACC15] text-black shadow-[0_14px_30px_rgba(250,204,21,0.25)]">
                <WhatsAppMark />
              </span>
            </div>

            <div className="mt-6 grid grid-cols-2 gap-2 rounded-full bg-black/45 p-1.5 shadow-[inset_5px_5px_12px_rgba(0,0,0,0.75)]" aria-hidden="true">
              <span className={`rounded-full px-3 py-2 text-center text-xs font-bold ${step === "phone" ? "bg-[#FACC15] text-black" : "text-white/45"}`}>
                Phone
              </span>
              <span className={`rounded-full px-3 py-2 text-center text-xs font-bold ${step === "otp" ? "bg-[#FACC15] text-black" : "text-white/45"}`}>
                WhatsApp code
              </span>
            </div>

            {error ? (
              <div role="alert" className="mt-5 rounded-2xl border border-red-400/25 bg-red-500/10 px-4 py-3 text-sm leading-6 text-red-100">
                {error}
              </div>
            ) : null}
            {notice ? (
              <div role="status" className="mt-5 rounded-2xl border border-[#FACC15]/25 bg-[#FACC15]/10 px-4 py-3 text-sm leading-6 text-yellow-50">
                {notice}
              </div>
            ) : null}
            {devOtp ? (
              <div className="mt-5 rounded-2xl border border-dashed border-[#FACC15]/45 bg-black/35 px-4 py-3 text-sm text-yellow-50">
                Local preview only: your code is <strong className="tracking-[0.3em] text-[#FACC15]">{devOtp}</strong>
              </div>
            ) : null}

            {step === "phone" ? (
              <form onSubmit={handleSend} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="whatsapp-phone" className="text-sm font-semibold text-white/78">
                    WhatsApp phone number
                  </label>
                  <input
                    id="whatsapp-phone"
                    name="phone"
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(event) => setPhone(event.target.value)}
                    placeholder="+94771234567"
                    className={`mt-2.5 w-full rounded-2xl px-4 py-4 text-base font-semibold tracking-wide text-white outline-none placeholder:text-white/28 ${neuInset}`}
                  />
                  <p className="mt-2 text-xs leading-5 text-white/42">
                    Sri Lankan numbers can also start with 07. We will create your profile automatically after verification.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isSending}
                  className={`flex w-full items-center justify-center gap-2 rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FACC15] px-5 py-4 font-display text-base font-bold text-black disabled:cursor-not-allowed disabled:opacity-60 ${neuButton}`}
                >
                  <WhatsAppMark />
                  {isSending ? "Sending code…" : "Send WhatsApp Code"}
                </button>

                <p className="text-center text-xs leading-5 text-white/40">
                  By continuing, Supabase Auth verifies this number with a one-time code. No customer password is created.
                </p>
              </form>
            ) : (
              <form onSubmit={handleVerify} className="mt-6 space-y-5">
                <div>
                  <label htmlFor="whatsapp-code" className="text-sm font-semibold text-white/78">
                    6-digit WhatsApp code
                  </label>
                  <input
                    id="whatsapp-code"
                    name="token"
                    type="text"
                    inputMode="numeric"
                    autoComplete="one-time-code"
                    maxLength={WHATSAPP_OTP_LENGTH}
                    value={code}
                    onChange={(event) => setCode(event.target.value.replace(/\D/g, "").slice(0, WHATSAPP_OTP_LENGTH))}
                    placeholder="••••••"
                    className={`mt-2.5 w-full rounded-2xl px-4 py-4 text-center font-display text-2xl font-bold tracking-[0.45em] text-[#FACC15] outline-none placeholder:text-white/20 ${neuInset}`}
                  />
                  <p className="mt-2 text-xs leading-5 text-white/42">
                    Sent to <span className="font-semibold text-white/70">{sentPhone}</span>. After verification you go straight to My Profile.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={isVerifying || code.length !== WHATSAPP_OTP_LENGTH}
                  className={`w-full rounded-2xl bg-gradient-to-br from-[#FFD700] to-[#FACC15] px-5 py-4 font-display text-base font-bold text-black disabled:cursor-not-allowed disabled:opacity-50 ${neuButton}`}
                >
                  {isVerifying ? "Verifying…" : "Verify & Go to My Profile"}
                </button>

                <div className="flex flex-wrap items-center justify-between gap-3 text-sm">
                  <button type="button" onClick={changeNumber} className="font-semibold text-white/58 transition hover:text-[#FACC15]">
                    Change number
                  </button>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={isResending}
                    className="font-semibold text-[#FACC15] transition hover:text-[#FFD700] disabled:opacity-50"
                  >
                    {isResending ? "Resending…" : "Resend code"}
                  </button>
                </div>
              </form>
            )}
          </section>
        </section>

        <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-white/[0.06] pt-5 text-xs text-white/36">
          <p>Baduma.sl customer access is WhatsApp OTP only.</p>
          <p>Menu · Cart · Track Orders · Profile</p>
        </footer>
      </div>
    </main>
  );
}
