import type { DecimalValue, JsonObject, JsonValue } from "./types";

/** Public, price-pending menu data used by the customer catalog and cart. */
export interface PublicMenuCategory {
  id: string;
  name: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
}

export interface PublicMenuProduct {
  id: string;
  title: string;
  categoryId: string;
  categoryName: string;
  categorySlug: string;
  /** Customer-facing retail price. Cost price is Admin-only and never exposed here. */
  basePrice: DecimalValue;
  dayAssignment: string;
  quantity: string | null;
  productCategory: string | null;
  imageUrl: string | null;
  ingredients: JsonValue[];
  macros: JsonObject;
  isActive: boolean;
}

export interface PublicMenuData {
  products: PublicMenuProduct[];
  categories: PublicMenuCategory[];
  generatedAt: string;
  mode: "local" | "supabase";
}

/** 0.00 is a "price pending" placeholder, never an invented real price. */
export function isPricePending(value: DecimalValue | number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return true;
  const parsed = typeof value === "number" ? value : Number(value);
  return !Number.isFinite(parsed) || parsed <= 0;
}
