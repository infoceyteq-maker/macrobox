"use client";

import Image from "next/image";
import { Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signInAction, signInDemoAction } from "@/app/actions/auth";
import { isLocalMode, POS_SCHEMA } from "@/lib/pos/config";
import type { AppRole } from "@/lib/pos/types";

const DEMO_ROLES: { role: AppRole; label: string; hint: string }[] = [
  { role: "ADMIN", label: "Admin", hint: "Full control" },
  { role: "MANAGER", label: "Manager", hint: "Operations" },
  { role: "FRONT_DESK", label: "Front Desk", hint: "Accept & dispatch" },
  { role: "KITCHEN", label: "Kitchen", hint: "Prepare & ready" },
  { role: "DRIVER", label: "Driver", hint: "Delivery proof" },
  { role: "CUSTOMER", label: "Customer", hint: "Own orders" },
];

const neu =
  "rounded-[2rem] bg-[#DCE6DA] shadow-[14px_14px_28px_#b7c4b5,-14px_-14px_28px_#ffffff]";
const inset =
  "rounded-2xl bg-[#DCE6DA] shadow-[inset_7px_7px_14px_#b7c4b5,inset_-7px_-7px_14px_#ffffff]";
const primary =
  "rounded-2xl bg-[#8FBC8F] px-5 py-3 font-medium text-[#223028] shadow-[6px_6px_12px_#a9b9a7,-6px_-6px_12px_#ffffff] transition hover:bg-[#7CA982] disabled:cursor-not-allowed disabled:opacity-60";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const nextPath = searchParams.get("next") || "/pos";
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function complete() {
    setError(null);
    setMessage("Signed in. Opening the POS dashboard…");
    router.push(nextPath.startsWith("/") ? nextPath : "/pos");
    router.refresh();
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await signInAction({ email, password });
      if (!result.ok) {
        setError(result.error);
        return;
      }
      complete();
    });
  }

  function handleDemo(role: AppRole) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await signInDemoAction(role);
      if (!result.ok) {
        setError(result.error);
        return;
      }
      complete();
    });
  }

  return (
    <main className="min-h-screen bg-[#DCE6DA] px-4 py-8 text-[#2E3033] sm:px-8">
      <div className={`mx-auto grid max-w-6xl overflow-hidden ${neu} lg:grid-cols-[0.9fr_1.1fr]`}>
        <section className="flex flex-col justify-between gap-10 p-8 sm:p-12">
          <div className="flex items-center gap-4">
            <Image
              src="/macrobox_primary_cutout.png"
              alt="MacroBox"
              width={220}
              height={80}
              priority
              className="h-auto w-[190px] object-contain sm:w-[220px]"
            />
          </div>

          <div className="space-y-5">
            <p className="font-display text-sm font-semibold tracking-[0.3em] text-[#7CA982]">
              LIVE POS
            </p>
            <h1 className="font-display text-4xl font-bold leading-tight sm:text-5xl">
              Staff &amp; Admin
              <br />
              Portal
            </h1>
            <p className="max-w-md text-sm leading-7 text-[#4b5550] sm:text-base">
              Sign in to manage orders, kitchen flow, driver dispatch, delivery
              evidence, cash settlement, menu visibility, and transport settings.
            </p>
            <div className={`${inset} max-w-md px-5 py-4 text-sm leading-6 text-[#4b5550]`}>
              Connected to{" "}
              <span className="font-semibold text-[#2E3033]">
                {isLocalMode() ? "local PGlite live engine" : `Supabase schema ${POS_SCHEMA}`}
              </span>
              . Role permissions are enforced in the database, not just in this UI.
            </div>
          </div>

          <p className="text-xs text-[#6f7a74]">
            Demo passwords are stored server-side. Use a demo button or your own
            staff credentials.
          </p>
        </section>

        <section className={`m-3 rounded-[1.6rem] bg-[#F7F6F2] p-6 shadow-[inset_8px_8px_18px_#d7ddd4,inset_-8px_-8px_18px_#ffffff] sm:p-10`}>
          <div className="mx-auto max-w-lg">
            <h2 className="font-display text-2xl font-bold">Welcome back</h2>
            <p className="mt-2 text-sm text-[#66716b]">
              Use your MacroBox POS account to continue.
            </p>

            <form onSubmit={handleSubmit} className="mt-8 space-y-5">
              <label className="block space-y-2 text-sm font-medium">
                <span>Email address</span>
                <input
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="you@macrobox.local"
                  className={`w-full border-0 px-5 py-4 text-sm outline-none placeholder:text-[#9aa49e] ${inset}`}
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
                  className={`w-full border-0 px-5 py-4 text-sm outline-none placeholder:text-[#9aa49e] ${inset}`}
                  required
                />
              </label>

              {error ? (
                <div className="rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm text-[#8a3b2f]">
                  {error}
                </div>
              ) : null}
              {message ? (
                <div className="rounded-2xl bg-[#e2eddf] px-4 py-3 text-sm text-[#3f6b45]">
                  {message}
                </div>
              ) : null}

              <button type="submit" disabled={isPending} className={`${primary} w-full`}>
                {isPending ? "Signing in…" : "Sign in"}
              </button>
            </form>

            <div className="my-8 flex items-center gap-4 text-xs font-medium uppercase tracking-widest text-[#8b958f]">
              <span className="h-px flex-1 bg-[#d9dfd6]" />
              Or explore a demo role
              <span className="h-px flex-1 bg-[#d9dfd6]" />
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {DEMO_ROLES.map((item) => (
                <button
                  key={item.role}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleDemo(item.role)}
                  className={`${neu} group px-3 py-4 text-left transition hover:bg-[#e4ece1] disabled:opacity-60`}
                >
                  <span className="block font-display text-sm font-bold group-hover:text-[#5f8a68]">
                    {item.label}
                  </span>
                  <span className="mt-1 block text-xs text-[#6f7a74]">{item.hint}</span>
                </button>
              ))}
            </div>

            <p className="mt-8 text-center text-xs leading-5 text-[#7b857f]">
              Demo accounts are for verification only. Replace or disable them
              before production use.
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#DCE6DA]" />}>
      <LoginForm />
    </Suspense>
  );
}
