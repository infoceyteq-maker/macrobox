"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { createOrderAction, getCurrentActorAction } from "@/app/actions/pos";
import { signInDemoAction } from "@/app/actions/auth";
import { useCart } from "@/components/cart/cart-context";
import { cn, formatAmount, NEU } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import type { AppRole } from "@/lib/pos/types";

export default function CartCheckout() {
  const router = useRouter();
  const { lines, count, subtotal, pricePending, menuLoading, clear, setQuantity, removeLine } = useCart();
  const [customerId, setCustomerId] = useState<string | null>(null);
  const [actorRole, setActorRole] = useState<AppRole | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);
  const [deliveryAddress, setDeliveryAddress] = useState("");
  const [deliveryNotes, setDeliveryNotes] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let active = true;
    getCurrentActorAction()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setActorRole(result.data.role);
          if (result.data.role === "CUSTOMER") setCustomerId(result.data.id);
        }
      })
      .finally(() => {
        if (active) setCheckingSession(false);
      });
    return () => {
      active = false;
    };
  }, []);

  async function demoSignIn() {
    setBusy(true);
    const result = await signInDemoAction("CUSTOMER");
    setBusy(false);
    if (!result.ok) {
      notify.error("Sign-in failed", `[${result.code}] ${result.error}`);
      return;
    }
    setCustomerId(result.data.userId);
    setActorRole("CUSTOMER");
    notify.success("Customer demo sign-in", "You can now place a COD order.");
    router.refresh();
  }

  async function placeOrder() {
    if (!customerId) {
      notify.error("Customer sign-in required", "Sign in as a customer before checkout.");
      return;
    }
    if (lines.length === 0) {
      notify.warning("Cart is empty", "Add a weekday meal first.");
      return;
    }
    const items = lines.map((line) => ({ productId: line.productId, quantity: line.quantity }));
    if (items.some((item) => !item.productId)) {
      notify.error("Menu sync incomplete", "Please refresh and try again.");
      return;
    }

    setBusy(true);
    const result = await createOrderAction({
      customerId,
      items,
      ...(deliveryAddress.trim() ? { deliveryAddress: deliveryAddress.trim() } : {}),
      ...(deliveryNotes.trim() ? { deliveryNotes: deliveryNotes.trim() } : {}),
    });
    setBusy(false);

    if (!result.ok) {
      notify.error("Order not placed", `[${result.code}] ${result.error}`);
      return;
    }

    notify.success("New Order Received", `Order #${result.data.id.slice(0, 8)} placed with COD.`);
    clear();
    router.push("/orders");
    router.refresh();
  }

  const canCheckout = Boolean(customerId) && lines.length > 0 && !busy && !menuLoading;

  return (
    <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">Basket</p>
            <h2 className="mt-1 font-display text-2xl font-bold">{count} item{count === 1 ? "" : "s"}</h2>
          </div>
          <Link href="/" className={cn(NEU.button, "text-center")}>
            Add more
          </Link>
        </div>

        <div className="mt-5 space-y-3">
          {lines.length === 0 ? (
            <div className={cn(NEU.inset, "px-5 py-12 text-center")}>
              <p className="font-display text-lg font-bold">Nothing here yet</p>
              <p className="mt-2 text-sm text-[#6f7a74]">Choose Monday–Friday meals from the menu.</p>
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.mealId} className={cn(NEU.cardSmall, "flex items-center gap-4 p-3")}>
                <Image
                  src={line.image}
                  alt=""
                  width={84}
                  height={84}
                  className="h-[84px] w-[84px] rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="font-display text-base font-bold">{line.day}</p>
                  <p className="truncate text-xs text-[#6f7a74]">{line.title}</p>
                  <p className="mt-1 text-sm font-semibold text-[#3f6b45]">
                    {line.pricePending ? "Price pending" : formatAmount(line.unitPrice * line.quantity)}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity(line.mealId, line.quantity - 1)}
                    className={cn(NEU.button, "h-9 w-9 !px-0 !py-0")}
                    aria-label={`Decrease ${line.day}`}
                  >
                    −
                  </button>
                  <span className="w-6 text-center font-bold">{line.quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity(line.mealId, line.quantity + 1)}
                    className={cn(NEU.button, "h-9 w-9 !px-0 !py-0")}
                    aria-label={`Increase ${line.day}`}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    onClick={() => removeLine(line.mealId)}
                    className="ml-2 text-xs font-semibold text-[#8a542b] hover:underline"
                  >
                    Remove
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </section>

      <aside className="space-y-6">
        <section className={cn(NEU.card, "p-5 sm:p-6")}>
          <h2 className="font-display text-xl font-bold">COD checkout</h2>
          <p className="mt-1 text-sm text-[#6f7a74]">Pay cash when your order arrives.</p>

          <div className="mt-5 space-y-4">
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                Delivery address
              </span>
              <textarea
                className={cn(NEU.input, "min-h-24 resize-y")}
                value={deliveryAddress}
                onChange={(event) => setDeliveryAddress(event.target.value)}
                placeholder="Enter your delivery address"
              />
            </label>
            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                Notes (optional)
              </span>
              <textarea
                className={cn(NEU.input, "min-h-20 resize-y")}
                value={deliveryNotes}
                onChange={(event) => setDeliveryNotes(event.target.value)}
                placeholder="Gate code, landmark, or delivery note"
              />
            </label>
          </div>
        </section>

        <section className={cn(NEU.card, "p-5 sm:p-6")}>
          <h2 className="font-display text-xl font-bold">Order summary</h2>
          <div className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[#6f7a74]">Food subtotal</span>
              <span className="font-display text-lg font-bold">{formatAmount(subtotal)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#6f7a74]">Transport</span>
              <span className="font-semibold">At delivery</span>
            </div>
            <div className={cn(NEU.inset, "flex justify-between gap-3 px-4 py-3")}>
              <span className="font-semibold">Final e-bill</span>
              <span className="font-display text-lg font-bold">
                {formatAmount(subtotal)} + transport
              </span>
            </div>
          </div>

          {pricePending ? (
            <p className={cn(NEU.insetTiny, "mt-4 px-3 py-2 text-xs leading-5 text-[#6f7a74]")}>
              Product prices are pending Admin confirmation. 0.00 is a placeholder, not a real charge.
            </p>
          ) : null}

          {checkingSession ? (
            <p className="mt-5 text-sm text-[#6f7a74]">Checking your session…</p>
          ) : customerId ? (
            <button
              type="button"
              onClick={placeOrder}
              disabled={!canCheckout}
              className={cn(NEU.buttonPrimary, "mt-5 w-full")}
            >
              {busy ? "Placing order…" : "Place COD order"}
            </button>
          ) : (
            <div className="mt-5 space-y-3">
              {actorRole && actorRole !== "CUSTOMER" ? (
                <p className="text-xs leading-5 text-[#8a542b]">
                  You are signed in as {actorRole}. Use the POS New order screen to create an order for a
                  customer, or sign out and use a customer account.
                </p>
              ) : null}
              <Link href="/login?next=/cart" className={cn(NEU.buttonPrimary, "block w-full text-center")}>
                Sign in to checkout
              </Link>
              <button
                type="button"
                onClick={demoSignIn}
                disabled={busy}
                className={cn(NEU.button, "w-full")}
              >
                Use demo customer
              </button>
            </div>
          )}
        </section>
      </aside>
    </div>
  );
}
