/**
 * Generated placeholder photography for the seeded MacroBox catalog.
 *
 * Admin-uploaded `image_url` values always win. These local public assets are
 * the deterministic fallback/migration mapping for the known weekday combos
 * and individually purchasable portions, so every seeded product card renders
 * a product-specific image instead of reusing the combo photo.
 */
export const COMBO_IMAGE_BY_DAY: Record<string, string> = {
  Monday: "/images/products/monday-rice-curry-combo.jpg",
  Tuesday: "/images/products/tuesday-healthy-bowl.jpg",
  Wednesday: "/images/products/wednesday-specialty-plate.jpg",
  Thursday: "/images/products/thursday-lean-meal.jpg",
  Friday: "/images/products/friday-recovery-bowl.jpg",
};

export const PRODUCT_IMAGE_BY_TITLE: Record<string, string> = {
  "Basmathi rice": "/images/products/basmathi-rice.jpg",
  "Dhal curry": "/images/products/dhal-curry.jpg",
  "Black pepper chicken": "/images/products/black-pepper-chicken.jpg",
  Eggs: "/images/products/boiled-eggs.jpg",
  "Boiled Eggs": "/images/products/boiled-eggs.jpg",
  "Boiled Eggs (2 pieces)": "/images/products/boiled-eggs.jpg",
  Broccoli: "/images/products/steamed-broccoli.jpg",
  "Steamed Broccoli": "/images/products/steamed-broccoli.jpg",
  "Roasted chickpeas": "/images/products/roasted-chickpeas.jpg",
  Salad: "/images/products/fresh-green-salad.jpg",
  "Fresh Green Salad": "/images/products/fresh-green-salad.jpg",
  "Gotukola sambol": "/images/products/gotukola-sambol.jpg",
  "Baked potato": "/images/products/baked-potato.jpg",
  "Chicken breast": "/images/products/grilled-chicken-breast.jpg",
  "Grilled Chicken Breast": "/images/products/grilled-chicken-breast.jpg",
  "Boiled vegetables (carrot, beans, potato, cabbage)":
    "/images/products/boiled-vegetables.jpg",
  "Boiled Vegetables": "/images/products/boiled-vegetables.jpg",
  "Boiled corn": "/images/products/boiled-corn.jpg",
  "Chinese cucumber": "/images/products/chinese-cucumber.jpg",
};

const NORMALIZED_PRODUCT_IMAGE_BY_TITLE = new Map(
  Object.entries(PRODUCT_IMAGE_BY_TITLE).map(([title, image]) => [
    normalizeProductTitle(title),
    image,
  ]),
);

const NORMALIZED_COMBO_IMAGE_BY_DAY = new Map(
  Object.entries(COMBO_IMAGE_BY_DAY).map(([day, image]) => [
    day.trim().toLowerCase(),
    image,
  ]),
);

export function normalizeProductTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

export function comboImageForDay(day: string | null | undefined): string | null {
  if (!day) return null;
  return NORMALIZED_COMBO_IMAGE_BY_DAY.get(day.trim().toLowerCase()) ?? null;
}

export function productImageForTitle(
  title: string | null | undefined,
  day?: string | null,
): string | null {
  if (!title) return comboImageForDay(day);
  const normalized = normalizeProductTitle(title);

  const exact = NORMALIZED_PRODUCT_IMAGE_BY_TITLE.get(normalized);
  if (exact) return exact;

  // Seeded weekday combos all share the supplied product title, so their day
  // assignment is the correct discriminator.
  if (normalized === "macrobox - healthy foods") {
    return comboImageForDay(day);
  }

  if (normalized.startsWith("boiled vegetables")) {
    return PRODUCT_IMAGE_BY_TITLE["Boiled Vegetables"];
  }

  return null;
}

export function publicProductImage(product: {
  title: string;
  dayAssignment?: string | null;
  categoryName?: string | null;
  imageUrl?: string | null;
  ingredients?: unknown[];
}): string | null {
  if (product.imageUrl) return product.imageUrl;

  const byTitle = productImageForTitle(
    product.title,
    product.dayAssignment ?? product.categoryName,
  );
  if (byTitle) return byTitle;

  // A renamed multi-ingredient weekday combo still maps to that weekday's
  // generated combo photography; single-ingredient products use title mapping.
  if ((product.ingredients?.length ?? 0) > 1) {
    return comboImageForDay(product.dayAssignment ?? product.categoryName);
  }

  return null;
}
