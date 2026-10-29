"use client";

import { createContext, useContext } from "react";
import type { PublicMenuData, PublicMenuProduct } from "@/lib/pos/public-menu";

export interface CartMeal {
  id: string;
  day: string;
  title: string;
  imagePlaceholder: string;
}

export interface CartIngredient {
  name: string;
  amount: string;
}

export interface CartLine {
  mealId: string;
  day: string;
  title: string;
  image: string;
  productId: string;
  unitPrice: number;
  quantity: number;
  pricePending: boolean;
}

export interface CartContextValue {
  lines: CartLine[];
  count: number;
  subtotal: number;
  pricePending: boolean;
  menu: PublicMenuData | null;
  menuLoading: boolean;
  isCartOpen: boolean;
  productForMeal: (meal: CartMeal) => PublicMenuProduct | null;
  productForIngredient: (meal: CartMeal, ingredient: CartIngredient) => PublicMenuProduct | null;
  addMeal: (meal: CartMeal, quantity?: number) => void;
  addIngredient: (meal: CartMeal, ingredient: CartIngredient, quantity?: number) => void;
  removeLine: (mealId: string) => void;
  setQuantity: (mealId: string, quantity: number) => void;
  clear: () => void;
  openCart: () => void;
  closeCart: () => void;
}

export const CartContext = createContext<CartContextValue | null>(null);

const fallback: CartContextValue = {
  lines: [],
  count: 0,
  subtotal: 0,
  pricePending: true,
  menu: null,
  menuLoading: true,
  isCartOpen: false,
  productForMeal: () => null,
  productForIngredient: () => null,
  addMeal: () => undefined,
  addIngredient: () => undefined,
  removeLine: () => undefined,
  setQuantity: () => undefined,
  clear: () => undefined,
  openCart: () => undefined,
  closeCart: () => undefined,
};

/** Safe in isolated component tests; the root layout supplies the real provider. */
export function useCart(): CartContextValue {
  return useContext(CartContext) ?? fallback;
}
