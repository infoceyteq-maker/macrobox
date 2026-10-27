"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect } from "react";
import { useCart } from "@/components/cart/cart-context";
import { cn, formatAmount, NEU } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";

export default function CartDrawer() {
  const { lines, count, subtotal, pricePending, isCartOpen, closeCart, removeLine, setQuantity, clear } =
    useCart();

  useEffect(() => {
    if (!isCartOpen) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeCart, isCartOpen]);

  if (!isCartOpen) return null;

  return (
    <div className="fixed inset-0 z-[90] flex justify-end bg-[#2E3033]/25 backdrop-blur-sm" role="presentation">
      <button
        type="button"
        aria-label="Close cart"
        onClick={closeCart}
        className="absolute inset-0 cursor-default"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="cart-drawer-title"
        className={cn(
          NEU.card,
          "relative m-0 flex h-full w-full max-w-md flex-col rounded-l-[2rem] rounded-r-none p-5 sm:m-4 sm:h-[calc(100%-2rem)] sm:rounded-[2rem]",
        )}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">Your basket</p>
            <h2 id="cart-drawer-title" className="mt-1 font-display text-2xl font-bold">
              Cart ({count})
            </h2>
          </div>
          <button type="button" onClick={closeCart} className={cn(NEU.button, "px-3 py-2")}>
            Close
          </button>
        </div>

        <div className="mt-6 flex-1 space-y-3 overflow-y-auto pr-1">
          {lines.length === 0 ? (
            <div className={cn(NEU.inset, "px-5 py-10 text-center")}>
              <p className="font-display text-lg font-bold">Your cart is empty</p>
              <p className="mt-2 text-sm text-[#6f7a74]">Add a weekday meal from the digital menu.</p>
            </div>
          ) : (
            lines.map((line) => (
              <div key={line.mealId} className={cn(NEU.cardSmall, "flex gap-3 p-3")}>
                <Image
                  src={line.image}
                  alt=""
                  width={72}
                  height={72}
                  className="h-[72px] w-[72px] rounded-2xl object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate font-display text-sm font-bold">{line.day}</p>
                  <p className="truncate text-xs text-[#6f7a74]">{line.title}</p>
                  <p className="mt-1 text-xs font-semibold text-[#3f6b45]">
                    {line.pricePending ? "Price pending" : formatAmount(line.unitPrice)}
                  </p>
                  <div className="mt-2 flex items-center gap-2">
                    <button
                      type="button"
                      aria-label={`Decrease ${line.day} quantity`}
                      onClick={() => setQuantity(line.mealId, line.quantity - 1)}
                      className={cn(NEU.button, "h-8 w-8 !px-0 !py-0")}
                    >
                      −
                    </button>
                    <span className="w-6 text-center text-sm font-bold">{line.quantity}</span>
                    <button
                      type="button"
                      aria-label={`Increase ${line.day} quantity`}
                      onClick={() => setQuantity(line.mealId, line.quantity + 1)}
                      className={cn(NEU.button, "h-8 w-8 !px-0 !py-0")}
                    >
                      +
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        removeLine(line.mealId);
                        notify.info("Removed from cart", `${line.day} meal removed.`);
                      }}
                      className="ml-auto text-xs font-semibold text-[#8a542b] hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>

        <div className="mt-4 space-y-3 border-t border-white/70 pt-4">
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6f7a74]">Food subtotal</span>
            <span className="font-display text-lg font-bold">{formatAmount(subtotal)}</span>
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-[#6f7a74]">Transport</span>
            <span className="font-semibold">Calculated at delivery</span>
          </div>
          {pricePending ? (
            <p className={cn(NEU.insetTiny, "px-3 py-2 text-xs leading-5 text-[#6f7a74]")}>
              Prices are pending Admin confirmation. No real price has been invented.
            </p>
          ) : null}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                clear();
                notify.info("Cart cleared", "All items removed.");
              }}
              disabled={lines.length === 0}
              className={cn(NEU.button, "flex-1")}
            >
              Clear
            </button>
            <Link
              href="/cart"
              onClick={closeCart}
              className={cn(NEU.buttonPrimary, "flex-[1.4] text-center")}
            >
              Checkout · COD
            </Link>
          </div>
        </div>
      </aside>
    </div>
  );
}
