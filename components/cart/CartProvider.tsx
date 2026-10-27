"use client";

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { usePathname } from "next/navigation";
import { getPublicMenuAction } from "@/app/actions/public-menu";
import { CartContext, type CartLine, type CartMeal } from "@/components/cart/cart-context";
import CartDrawer from "@/components/cart/CartDrawer";
import { cn, NEU } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import { isPricePending, type PublicMenuData, type PublicMenuProduct } from "@/lib/pos/public-menu";

const STORAGE_KEY = "macrobox_cart_v1";

function isCartLine(value: unknown): value is CartLine {
  if (!value || typeof value !== "object") return false;
  const line = value as Record<string, unknown>;
  return (
    typeof line.mealId === "string" &&
    typeof line.day === "string" &&
    typeof line.title === "string" &&
    typeof line.image === "string" &&
    typeof line.productId === "string" &&
    typeof line.unitPrice === "number" &&
    typeof line.quantity === "number" &&
    typeof line.pricePending === "boolean"
  );
}

export default function CartProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [lines, setLines] = useState<CartLine[]>([]);
  const [menu, setMenu] = useState<PublicMenuData | null>(null);
  const [menuLoading, setMenuLoading] = useState(true);
  const [isCartOpen, setCartOpen] = useState(false);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      const parsed = JSON.parse(raw) as unknown;
      if (Array.isArray(parsed)) setLines(parsed.filter(isCartLine));
    } catch {
      // Ignore malformed local cart state; the UI starts with an empty cart.
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(lines));
    } catch {
      // Storage can be unavailable in private browsing; cart still works in memory.
    }
  }, [lines]);

  useEffect(() => {
    let active = true;
    getPublicMenuAction()
      .then((result) => {
        if (!active) return;
        if (result.ok) {
          setMenu(result.data);
        } else {
          notify.error("Menu sync failed", `[${result.code}] ${result.error}`);
        }
      })
      .catch((error: unknown) => {
        if (!active) return;
        notify.error("Menu sync failed", error instanceof Error ? error.message : "Unexpected error.");
      })
      .finally(() => {
        if (active) setMenuLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const productIndex = useMemo(() => {
    const map = new Map<string, PublicMenuProduct>();
    for (const product of menu?.products ?? []) {
      if (!product.isActive) continue;
      const nameKey = product.categoryName.trim().toLowerCase();
      const slugKey = product.categorySlug.trim().toLowerCase();
      if (!map.has(nameKey)) map.set(nameKey, product);
      if (!map.has(slugKey)) map.set(slugKey, product);
      map.set(product.id.toLowerCase(), product);
    }
    return map;
  }, [menu]);

  const productForMeal = useCallback(
    (meal: CartMeal): PublicMenuProduct | null =>
      productIndex.get(meal.day.trim().toLowerCase()) ??
      productIndex.get(meal.id.trim().toLowerCase()) ??
      null,
    [productIndex],
  );

  const addMeal = useCallback(
    (meal: CartMeal, quantity = 1) => {
      const product = productForMeal(meal);
      if (!product) {
        notify.warning("Menu is syncing", "Please try again in a moment.");
        return;
      }
      const unitPrice = Number(product.basePrice) || 0;
      const pending = isPricePending(product.basePrice);
      setLines((current) => {
        const existing = current.find((line) => line.mealId === meal.id);
        if (existing) {
          return current.map((line) =>
            line.mealId === meal.id
              ? { ...line, quantity: Math.min(99, line.quantity + quantity) }
              : line,
          );
        }
        return [
          ...current,
          {
            mealId: meal.id,
            day: meal.day,
            title: meal.title,
            image: meal.imagePlaceholder,
            productId: product.id,
            unitPrice,
            quantity: Math.min(99, Math.max(1, quantity)),
            pricePending: pending,
          },
        ];
      });
      notify.success("Added to cart", `${meal.day} · ${quantity} meal${quantity === 1 ? "" : "s"}`);
    },
    [productForMeal],
  );

  const removeLine = useCallback((mealId: string) => {
    setLines((current) => current.filter((line) => line.mealId !== mealId));
  }, []);

  const setQuantity = useCallback((mealId: string, quantity: number) => {
    setLines((current) =>
      quantity <= 0
        ? current.filter((line) => line.mealId !== mealId)
        : current.map((line) =>
            line.mealId === mealId ? { ...line, quantity: Math.min(99, quantity) } : line,
          ),
    );
  }, []);

  const clear = useCallback(() => setLines([]), []);
  const openCart = useCallback(() => setCartOpen(true), []);
  const closeCart = useCallback(() => setCartOpen(false), []);

  const count = lines.reduce((sum, line) => sum + line.quantity, 0);
  const subtotal = lines.reduce((sum, line) => sum + line.unitPrice * line.quantity, 0);
  const pricePending = lines.some((line) => line.pricePending);
  const showCartFab = pathname === "/" || pathname === "/cart";

  return (
    <CartContext.Provider
      value={{
        lines,
        count,
        subtotal,
        pricePending,
        menu,
        menuLoading,
        isCartOpen,
        productForMeal,
        addMeal,
        removeLine,
        setQuantity,
        clear,
        openCart,
        closeCart,
      }}
    >
      {children}
      {showCartFab ? (
        <button
          type="button"
          onClick={openCart}
          aria-label={`Open cart, ${count} items`}
          className={cn(
            NEU.buttonPrimary,
            "fixed bottom-5 left-5 z-[80] flex items-center gap-2 !rounded-full !px-5 !py-3",
          )}
        >
          <span aria-hidden="true">🛒</span>
          <span>Cart</span>
          <span className="flex h-6 min-w-6 items-center justify-center rounded-full bg-[#F7F6F2] px-1 text-xs font-bold text-[#22301f] shadow-[inset_2px_2px_5px_#c6d0c2,inset_-2px_-2px_5px_#ffffff]">
            {count}
          </span>
        </button>
      ) : null}
      <CartDrawer />
    </CartContext.Provider>
  );
}
