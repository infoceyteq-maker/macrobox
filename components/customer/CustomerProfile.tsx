"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import {
  sendCustomerEmailLinkAction,
  updateCustomerProfileAction,
} from "@/app/actions/customer-profile";
import { signOutAction } from "@/app/actions/auth";
import { getCurrentActorAction } from "@/app/actions/pos";
import { NEU, cn } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import type { AppUserRow } from "@/lib/pos/types";

interface CustomerProfileProps {
  initialProfile: AppUserRow;
  continuePath?: string;
}

const inputClass = cn(NEU.input, "px-5 py-4");

export default function CustomerProfile({
  initialProfile,
  continuePath = "/",
}: CustomerProfileProps) {
  const router = useRouter();
  const [profile, setProfile] = useState(initialProfile);
  const [name, setName] = useState(initialProfile.name === "MacroBox Customer" ? "" : initialProfile.name);
  const [deliveryAddress, setDeliveryAddress] = useState(initialProfile.delivery_address ?? "");
  const [deliveryNotes, setDeliveryNotes] = useState(initialProfile.delivery_notes ?? "");
  const [email, setEmail] = useState(initialProfile.email ?? "");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  async function refreshProfile() {
    const result = await getCurrentActorAction();
    if (result.ok) {
      setProfile(result.data);
      setName(result.data.name === "MacroBox Customer" ? "" : result.data.name);
      setDeliveryAddress(result.data.delivery_address ?? "");
      setDeliveryNotes(result.data.delivery_notes ?? "");
      setEmail(result.data.email ?? "");
    }
  }

  function saveProfile(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    startTransition(async () => {
      const result = await updateCustomerProfileAction({
        name,
        deliveryAddress,
        deliveryNotes,
      });
      if (!result.ok) {
        setError(result.error);
        notify.error("Profile not saved", result.error);
        return;
      }
      setProfile(result.data);
      setMessage("Profile saved. Your delivery details will pre-fill at checkout.");
      notify.success("Profile saved", "Optional details are now available at checkout.");
      router.refresh();
    });
  }

  function sendEmailLink(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError("Enter an email address first.");
      return;
    }

    startTransition(async () => {
      const result = await sendCustomerEmailLinkAction({ email });
      if (!result.ok) {
        setError(result.error);
        notify.error("Email link not sent", result.error);
        return;
      }
      await refreshProfile();
      setMessage("Verification link sent. Confirm it from your inbox to finish linking this email.");
      notify.success("Email link sent", "Check your inbox to confirm the address.");
      router.refresh();
    });
  }

  async function signOut() {
    setError(null);
    const result = await signOutAction();
    if (!result.ok) {
      setError(result.error);
      notify.error("Sign-out failed", result.error);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <main className={cn(NEU.page, "px-4 py-6 sm:px-8")}>
      <div className="mx-auto max-w-5xl space-y-6">
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
              <h1 className="font-display text-xl font-bold sm:text-2xl">My Profile</h1>
              <p className="mt-1 text-xs text-[#6f7a74]">Phone verified · No password required</p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {continuePath !== "/" ? (
              <Link href={continuePath} className={cn(NEU.buttonPrimary, "text-center")}>
                Continue
              </Link>
            ) : null}
            <Link href="/" className={cn(NEU.button, "text-center")}>Menu</Link>
            <Link href="/cart" className={cn(NEU.button, "text-center")}>Cart</Link>
            <Link href="/orders" className={cn(NEU.button, "text-center")}>Track</Link>
            <button type="button" onClick={signOut} className={NEU.button}>
              Sign out
            </button>
          </div>
        </header>

        {error ? (
          <div className="rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm text-[#8a3b2f]" role="alert">
            {error}
          </div>
        ) : null}
        {message ? (
          <div className="rounded-2xl bg-[#e2eddf] px-4 py-3 text-sm text-[#3f6b45]">{message}</div>
        ) : null}

        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className={cn(NEU.card, "p-5 sm:p-7")}>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">
              Optional details
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Delivery profile</h2>
            <p className="mt-2 text-sm leading-6 text-[#6f7a74]">
              Fill these in now or later. They pre-fill checkout but are never required to sign in.
            </p>

            <form onSubmit={saveProfile} className="mt-6 space-y-4">
              <label className="block space-y-2 text-sm font-medium">
                <span>Name</span>
                <input
                  autoComplete="name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your name"
                  className={inputClass}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Delivery address</span>
                <textarea
                  autoComplete="street-address"
                  value={deliveryAddress}
                  onChange={(event) => setDeliveryAddress(event.target.value)}
                  placeholder="Flat / street / city"
                  className={cn(inputClass, "min-h-28 resize-y")}
                />
              </label>
              <label className="block space-y-2 text-sm font-medium">
                <span>Delivery notes</span>
                <textarea
                  value={deliveryNotes}
                  onChange={(event) => setDeliveryNotes(event.target.value)}
                  placeholder="Gate code, landmark, or drop-off note"
                  className={cn(inputClass, "min-h-24 resize-y")}
                />
              </label>
              <button
                type="submit"
                disabled={isPending}
                className={cn(NEU.buttonPrimary, "w-full py-4")}
              >
                {isPending ? "Saving…" : "Save profile"}
              </button>
            </form>
          </section>

          <aside className="space-y-6">
            <section className={cn(NEU.card, "p-5 sm:p-6")}>
              <h2 className="font-display text-xl font-bold">Verified phone</h2>
              <div className={cn(NEU.inset, "mt-4 px-4 py-4")}>
                <p className="text-xs uppercase tracking-widest text-[#7b857f]">Primary sign-in</p>
                <p className="mt-2 font-display text-xl font-bold">
                  {profile.phone ?? "Not available"}
                </p>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#6f7a74]">
                Your account was created automatically after SMS verification. There is no password to manage.
              </p>
            </section>

            <section className={cn(NEU.card, "p-5 sm:p-6")}>
              <h2 className="font-display text-xl font-bold">Optional email</h2>
              <p className="mt-1 text-sm text-[#6f7a74]">
                Add an email to receive e-bills and a magic link for future sign-in.
              </p>
              <form onSubmit={sendEmailLink} className="mt-5 space-y-4">
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
                <button
                  type="submit"
                  disabled={isPending || !email.trim()}
                  className={cn(NEU.button, "w-full py-4")}
                >
                  {isPending ? "Sending…" : profile.email ? "Update email" : "Send verification link"}
                </button>
              </form>
              {profile.email ? (
                <p className="mt-3 text-xs text-[#3f6b45]">Currently linked: {profile.email}</p>
              ) : null}
            </section>
          </aside>
        </div>
      </div>
    </main>
  );
}
