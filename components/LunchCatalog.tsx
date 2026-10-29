"use client";

import Image from "next/image";
import {
  AnimatePresence,
  LayoutGroup,
  motion,
  useReducedMotion,
  type Transition,
} from "framer-motion";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type MouseEvent as ReactMouseEvent,
} from "react";
import { useCart } from "@/components/cart/cart-context";
import { CUSTOMER_CONTACT } from "@/lib/brand";
import { isPricePending, type PublicMenuProduct } from "@/lib/pos/public-menu";

export interface Meal {
  id: string;
  day: string;
  title: string;
  ingredients: { name: string; amount: string }[];
  macros: {
    protein: string;
    carbs: string;
    fat: string;
    calories: string;
    vitamins?: string;
    minerals?: string;
  };
  imagePlaceholder: string;
}

// Supplied menu data is intentionally preserved verbatim. Nutrition and health
// claims should be reviewed by the business before production publication.
export const lunchMenu: Meal[] = [
  {
    id: "mon",
    day: "Monday",
    title: "MacroBox - Healthy Foods",
    imagePlaceholder: "/images/monday-bowl.jpg",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Dhal curry", amount: "75g" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Eggs", amount: "2" },
      { name: "Broccoli", amount: "75g" },
    ],
    macros: {
      protein: "54.5g",
      carbs: "38g",
      fat: "11g",
      calories: "469 kcal",
    },
  },
  {
    id: "tue",
    day: "Tuesday",
    title: "MacroBox - Healthy Foods",
    imagePlaceholder: "/images/tuesday-bowl.jpg",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Roasted chickpeas", amount: "75g" },
      { name: "Eggs", amount: "2" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Salad", amount: "75g" },
    ],
    macros: {
      protein: "58g",
      carbs: "71.3g",
      fat: "23.9g",
      calories: "542.6 kcal",
    },
  },
  {
    id: "wed",
    day: "Wednesday",
    title: "MacroBox - Healthy Foods",
    imagePlaceholder: "/images/wednesday-bowl.jpg",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Gotukola sambol", amount: "75g" },
      { name: "Baked potato", amount: "75g" },
      { name: "Eggs", amount: "2" },
    ],
    macros: {
      protein: "48g",
      carbs: "175.2g",
      fat: "176.4g",
      calories: "546.4 kcal",
    },
  },
  {
    id: "thu",
    day: "Thursday",
    title: "MacroBox - Healthy Foods",
    imagePlaceholder: "/images/thursday-bowl.jpg",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Chicken breast", amount: "100g" },
      { name: "Eggs", amount: "2" },
      { name: "Dhal curry", amount: "75g" },
      {
        name: "Boiled vegetables (carrot, beans, potato, cabbage)",
        amount: "75g",
      },
    ],
    macros: {
      protein: "52.3g",
      carbs: "44.3g",
      fat: "16.9g",
      calories: "538.5 kcal",
    },
  },
  {
    id: "fri",
    day: "Friday",
    title: "MacroBox - Healthy Foods",
    imagePlaceholder: "/images/friday-bowl.jpg",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Boiled corn", amount: "75g" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Eggs", amount: "2" },
      { name: "Chinese cucumber", amount: "75g" },
    ],
    macros: {
      protein: "49.4g",
      carbs: "47.3g",
      fat: "15.4g",
      calories: "525.4 kcal",
    },
  },
];

export type MealIngredient = Meal["ingredients"][number];
export type MealMacros = Meal["macros"];

/**
 * A custom curry/dish can replace an existing ingredient by name or be added
 * to that day's ingredient list.
 */
export interface CustomDish extends MealIngredient {
  replaces?: string;
}

/**
 * Structural integration point for the dish/image upload pipeline. Key the map
 * by the weekday id: mon, tue, wed, thu, or fri.
 */
export interface MealUpdate {
  day?: string;
  title?: string;
  imagePlaceholder?: string;
  ingredients?: MealIngredient[];
  customDishes?: CustomDish[];
  macros?: Partial<MealMacros>;
}

export type MealUpdateMap = Record<string, MealUpdate>;

export const MEAL_UPDATES_EVENT = "macrobox:meal-updates";

/**
 * Empty by design: the supplied Monday–Friday data remains the source of truth
 * until the upload pipeline supplies an update.
 */
export const uploadedMealUpdates: MealUpdateMap = {};

function applyCustomDishes(
  baseIngredients: MealIngredient[],
  customDishes?: CustomDish[],
): MealIngredient[] {
  if (!customDishes?.length) return baseIngredients;

  const nextIngredients = [...baseIngredients];

  for (const dish of customDishes) {
    const { replaces, ...ingredient } = dish;
    const replaceIndex = replaces
      ? nextIngredients.findIndex((item) => item.name === replaces)
      : -1;

    if (replaceIndex >= 0) {
      nextIngredients[replaceIndex] = ingredient;
    } else {
      nextIngredients.push(ingredient);
    }
  }

  return nextIngredients;
}

/** Merge uploaded dishes, images, ingredients, and macro changes by day id. */
export function applyMealUpdates(
  baseMenu: Meal[],
  updates: MealUpdateMap = {},
): Meal[] {
  return baseMenu.map((meal) => {
    const update = updates[meal.id];
    if (!update) return meal;

    const {
      ingredients: replacementIngredients,
      customDishes,
      macros: macroOverrides,
      ...mealOverrides
    } = update;

    return {
      ...meal,
      ...mealOverrides,
      ingredients:
        replacementIngredients ??
        applyCustomDishes(meal.ingredients, customDishes),
      macros: {
        ...meal.macros,
        ...macroOverrides,
      },
    };
  });
}

/** Publish runtime meal updates from an upload flow or CMS integration. */
export function publishMealUpdates(updates: MealUpdateMap) {
  if (typeof window === "undefined") return;

  window.dispatchEvent(
    new CustomEvent<MealUpdateMap>(MEAL_UPDATES_EVENT, { detail: updates }),
  );
}

function useMealMenu(externalUpdates?: MealUpdateMap) {
  const [eventUpdates, setEventUpdates] = useState<MealUpdateMap>({});

  useEffect(() => {
    const handleUpdates = (event: Event) => {
      const detail = (event as CustomEvent<MealUpdateMap>).detail;
      if (!detail || typeof detail !== "object" || Array.isArray(detail)) return;

      setEventUpdates((current) => ({ ...current, ...detail }));
    };

    window.addEventListener(MEAL_UPDATES_EVENT, handleUpdates);
    return () => window.removeEventListener(MEAL_UPDATES_EVENT, handleUpdates);
  }, []);

  const updates = useMemo(
    () => ({
      ...uploadedMealUpdates,
      ...(externalUpdates ?? {}),
      ...eventUpdates,
    }),
    [eventUpdates, externalUpdates],
  );

  return useMemo(() => applyMealUpdates(lunchMenu, updates), [updates]);
}

const categoryName = "Lunch (Rice & Curry)";

const RAISED_LARGE =
  "shadow-[10px_10px_22px_#B4C3B0,-10px_-10px_22px_#F8FBF4]";
const RAISED_SMALL =
  "shadow-[7px_7px_15px_#B4C3B0,-7px_-7px_15px_#F8FBF4]";
const RAISED_TINY =
  "shadow-[4px_4px_9px_#B4C3B0,-4px_-4px_9px_#F8FBF4]";
const INSET_SMALL =
  "shadow-[inset_5px_5px_11px_#B4C3B0,inset_-5px_-5px_11px_#F8FBF4]";
const INSET_TINY =
  "shadow-[inset_3px_3px_7px_#B4C3B0,inset_-3px_-3px_7px_#F8FBF4]";
const INSET_MEDIUM =
  "shadow-[inset_8px_8px_18px_#B4C3B0,inset_-8px_-8px_18px_#F8FBF4]";
const PRESSED_ON_ACTIVE =
  "active:shadow-[inset_6px_6px_12px_#B4C3B0,inset_-6px_-6px_12px_#F8FBF4]";
const INNER_PRESSED_ON_ACTIVE =
  "group-active:translate-y-[1px] group-active:shadow-[inset_4px_4px_9px_#B4C3B0,inset_-4px_-4px_9px_#F8FBF4]";
const FOCUS_RING =
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7CA982] focus-visible:ring-offset-4 focus-visible:ring-offset-[#DCE6DA]";

// Exact T-shirt / core brand greens. Interactive accents use only these two
// values: #8FBC8F as the surface and #7CA982 as the deep accent.
const ACCENT_SURFACE = "bg-[#8FBC8F]";
const ACCENT_SOFT_SURFACE = "bg-[#8FBC8F]/18";
const ACCENT_TEXT = "text-[#7CA982]";
const ACCENT_ACTIVE_BUTTON =
  "border-[#8FBC8F]/70 bg-[#8FBC8F] text-[#2C3E50] shadow-[inset_4px_4px_9px_#B4C3B0,inset_-4px_-4px_9px_#F8FBF4]";

type MacroKey = "protein" | "carbs" | "fat" | "calories";

const macroDetails: ReadonlyArray<{ key: MacroKey; label: string }> = [
  { key: "protein", label: "Protein" },
  { key: "carbs", label: "Carbs" },
  { key: "fat", label: "Fat" },
  { key: "calories", label: "Calories" },
];

function macroValue(value: string): number {
  const match = value.match(/\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : 0;
}

const MACRO_MAXIMA = macroDetails.reduce(
  (accumulator, { key }) => {
    accumulator[key] = Math.max(
      ...lunchMenu.map((meal) => macroValue(meal.macros[key])),
      1,
    );
    return accumulator;
  },
  {} as Record<MacroKey, number>,
);

function macroProgress(key: MacroKey, value: string): number {
  const maximum = MACRO_MAXIMA[key] || 1;
  return Math.min(100, Math.max(8, (macroValue(value) / maximum) * 100));
}

const artworkThemes = [
  {
    canvas:
      "bg-[radial-gradient(circle_at_30%_20%,#FCFDF9_0%,#E7EFE5_58%,#C9D7C9_100%)]",
    curry: "bg-[#D7A13D]",
    protein: "bg-[#A96F49]",
    greens: "bg-[#6E9868]",
    spice: "bg-[#C46F3D]",
  },
  {
    canvas:
      "bg-[radial-gradient(circle_at_70%_15%,#FCFCF6_0%,#E9EFE2_56%,#C7D5C5_100%)]",
    curry: "bg-[#C98A35]",
    protein: "bg-[#966343]",
    greens: "bg-[#7EA66C]",
    spice: "bg-[#B85B36]",
  },
  {
    canvas:
      "bg-[radial-gradient(circle_at_45%_15%,#FBFDF8_0%,#E4EDE5_55%,#C6D6C9_100%)]",
    curry: "bg-[#E0AD45]",
    protein: "bg-[#9C6746]",
    greens: "bg-[#628F61]",
    spice: "bg-[#D27A42]",
  },
  {
    canvas:
      "bg-[radial-gradient(circle_at_25%_25%,#FCFCF7_0%,#EAF0E4_58%,#C9D8C7_100%)]",
    curry: "bg-[#C9913E]",
    protein: "bg-[#A26947]",
    greens: "bg-[#719967]",
    spice: "bg-[#B9653B]",
  },
  {
    canvas:
      "bg-[radial-gradient(circle_at_65%_20%,#FBFCF7_0%,#E5EDE4_55%,#C5D4C8_100%)]",
    curry: "bg-[#DDA543]",
    protein: "bg-[#8F5B3E]",
    greens: "bg-[#709C6A]",
    spice: "bg-[#C46B3C]",
  },
] as const;

function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function ArrowIcon({ direction = "right" }: { direction?: "left" | "right" }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn("h-4 w-4", direction === "left" && "rotate-180")}
      aria-hidden="true"
    >
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg
      viewBox="0 0 20 20"
      fill="none"
      className="h-4 w-4 shrink-0"
      aria-hidden="true"
    >
      <circle cx="10" cy="10" r="9" fill="#8FBC8F" fillOpacity="0.18" />
      <path
        d="m6 10.2 2.5 2.5L14.4 7"
        stroke="#7CA982"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  );
}

function MacroIcon({ kind }: { kind: MacroKey }) {
  const shared = {
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    className: "h-5 w-5",
    "aria-hidden": true as const,
  };

  if (kind === "protein") {
    return (
      <svg {...shared}>
        <path d="M6.5 9v6M3.5 10.5v3M17.5 9v6M20.5 10.5v3M6.5 12h11" />
        <rect x="5" y="7.5" width="2.8" height="9" rx="1" />
        <rect x="16.2" y="7.5" width="2.8" height="9" rx="1" />
      </svg>
    );
  }

  if (kind === "carbs") {
    return (
      <svg {...shared}>
        <path d="M12 21V7" />
        <path d="M12 10c-2.6 0-4.5-1.4-4.5-3.4C10 6.5 12 7.6 12 10Z" />
        <path d="M12 10c2.6 0 4.5-1.4 4.5-3.4C14 6.5 12 7.6 12 10Z" />
        <path d="M12 15c-2.6 0-4.5-1.4-4.5-3.4 2.5-.1 4.5 1 4.5 3.4Z" />
        <path d="M12 15c2.6 0 4.5-1.4 4.5-3.4-2.5-.1-4.5 1-4.5 3.4Z" />
      </svg>
    );
  }

  if (kind === "fat") {
    return (
      <svg {...shared}>
        <path d="M12 3s6 6.4 6 10.5a6 6 0 0 1-12 0C6 9.4 12 3 12 3Z" />
        <path d="M9.2 14.2a2.8 2.8 0 0 0 2.8 2.8" />
      </svg>
    );
  }

  return (
    <svg {...shared}>
      <path d="M12 3c.8 3-1.6 4.3-1.6 6.4 0 1 .7 1.8 1.6 1.8s1.6-.8 1.6-1.8C13.6 8 16 6.8 15.2 4.7c2.5 2.4 3.8 4.8 3.8 7.6A7 7 0 1 1 5 12.3c0-2.2.9-4.2 2.7-6.3-.1 2.3 1.1 3.4 2.4 4.2C9.5 7.6 10.8 5.4 12 3Z" />
      <path d="M12 15.3c1.3 0 2.2.9 2.2 2s-.9 1.9-2.2 1.9-2.2-.8-2.2-1.9.9-2 2.2-2Z" />
    </svg>
  );
}

function MealArtwork({ seed }: { seed: string }) {
  const seedValue = Array.from(seed).reduce(
    (total, character) => total + character.charCodeAt(0),
    0,
  );
  const theme = artworkThemes[seedValue % artworkThemes.length];
  const spicePositions = [
    "left-[31%] top-[31%]",
    "left-[39%] top-[25%]",
    "left-[49%] top-[29%]",
    "left-[37%] top-[38%]",
    "left-[60%] top-[44%]",
    "left-[53%] top-[54%]",
    "left-[45%] top-[61%]",
  ];

  return (
    <div className={cn("absolute inset-0", theme.canvas)} aria-hidden="true">
      <div className="absolute left-[15%] top-[16%] h-16 w-16 rounded-full bg-white/35 blur-2xl" />
      <div className="absolute bottom-[-10%] left-1/2 h-[28%] w-[72%] -translate-x-1/2 rounded-[50%] bg-[#596F5F]/20 blur-2xl" />

      <div className="absolute left-1/2 top-1/2 aspect-square w-[68%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#FCFCF7] shadow-[16px_18px_30px_rgba(72,91,77,0.22),-10px_-10px_24px_rgba(255,255,255,0.9),inset_0_0_0_10px_#F0F2EA]">
        <div className="absolute inset-[11%] rounded-full border border-[#DDE4D9] shadow-[inset_3px_3px_8px_rgba(120,137,122,0.12)]" />

        <div className="absolute left-[25%] top-[24%] h-[34%] w-[32%] rotate-[-12deg] rounded-[48%] bg-[#F5F0DA] shadow-[inset_5px_5px_8px_rgba(176,166,132,0.18),3px_4px_7px_rgba(80,79,62,0.13)]" />
        <div
          className={cn(
            "absolute right-[22%] top-[26%] h-[31%] w-[31%] rotate-[14deg] rounded-[46%] shadow-[inset_5px_5px_9px_rgba(67,47,31,0.2),3px_5px_9px_rgba(80,79,62,0.15)]",
            theme.curry,
          )}
        />
        <div
          className={cn(
            "absolute bottom-[24%] left-[29%] h-[29%] w-[31%] rotate-[8deg] rounded-[48%] shadow-[inset_5px_5px_9px_rgba(67,47,31,0.2),3px_5px_9px_rgba(80,79,62,0.15)]",
            theme.protein,
          )}
        />
        <div
          className={cn(
            "absolute bottom-[29%] right-[23%] h-[25%] w-[27%] rotate-[-19deg] rounded-[48%] shadow-[inset_4px_4px_8px_rgba(38,70,38,0.2),3px_5px_9px_rgba(80,79,62,0.13)]",
            theme.greens,
          )}
        />
        <div className="absolute left-[45%] top-[47%] h-[15%] w-[15%] rounded-full bg-[#FFFDF4] shadow-[inset_2px_2px_4px_rgba(144,132,102,0.2)]">
          <div className="absolute left-1/2 top-1/2 h-[58%] w-[58%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-[#E8B94D] shadow-[inset_2px_2px_4px_rgba(151,104,25,0.25)]" />
        </div>

        {spicePositions.map((position) => (
          <span
            key={position}
            className={cn(
              "absolute h-[2.2%] w-[2.2%] rounded-full opacity-80 shadow-[1px_1px_2px_rgba(50,40,30,0.2)]",
              position,
              theme.spice,
            )}
          />
        ))}
      </div>

      <div className="absolute bottom-3 left-3 rounded-full border border-white/70 bg-[#FCFCF7]/75 px-3 py-1.5 text-[9px] font-semibold tracking-[0.16em] text-[#53675A] uppercase shadow-[3px_3px_7px_rgba(120,137,122,0.16)] backdrop-blur-sm">
        Photo placeholder
      </div>
    </div>
  );
}

interface MealImageProps {
  meal: Meal;
  layoutId: string;
  sizes: string;
  transition: Transition;
  className?: string;
  priority?: boolean;
}

function MealImage({
  meal,
  layoutId,
  sizes,
  transition,
  className,
  priority = false,
}: MealImageProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const imageRef = useRef<HTMLImageElement>(null);

  useEffect(() => {
    setImageFailed(false);

    // A cached 1×1 placeholder can finish loading before hydration attaches
    // onLoad, so verify its dimensions again after mount.
    const image = imageRef.current;
    if (
      image?.complete &&
      image.naturalWidth <= 1 &&
      image.naturalHeight <= 1
    ) {
      setImageFailed(true);
    }
  }, [meal.id, meal.imagePlaceholder]);

  return (
    <motion.div
      layoutId={layoutId}
      transition={transition}
      className={cn(
        "relative isolate overflow-hidden rounded-[1.65rem] bg-[#D3DFD0]",
        INSET_MEDIUM,
        className,
      )}
    >
      {imageFailed ? (
        <MealArtwork seed={meal.id} />
      ) : (
        <Image
          ref={imageRef}
          src={meal.imagePlaceholder}
          alt={`${meal.title} for ${meal.day}`}
          fill
          unoptimized
          priority={priority}
          sizes={sizes}
          className="object-cover"
          onLoad={(event) => {
            if (
              event.currentTarget.naturalWidth <= 1 &&
              event.currentTarget.naturalHeight <= 1
            ) {
              setImageFailed(true);
            }
          }}
          onError={() => setImageFailed(true)}
        />
      )}

      <div className="pointer-events-none absolute inset-0 rounded-[inherit] shadow-[inset_0_0_0_1px_rgba(255,255,255,0.72),inset_0_-30px_55px_rgba(44,62,80,0.1)]" />
    </motion.div>
  );
}

function productIngredients(product: PublicMenuProduct): Meal["ingredients"] | null {
  if (!Array.isArray(product.ingredients)) return null;
  const ingredients = product.ingredients.flatMap((item) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) return [];
    const record = item as Record<string, unknown>;
    const name = typeof record.name === "string" ? record.name : "";
    const amount =
      typeof record.amount === "string"
        ? record.amount
        : typeof record.amount === "number"
          ? String(record.amount)
          : "";
    return name ? [{ name, amount }] : [];
  });
  return ingredients.length > 0 ? ingredients : null;
}

function macroString(
  product: PublicMenuProduct,
  key: keyof Meal["macros"],
  fallback: string,
): string {
  const value = product.macros?.[key];
  if (typeof value === "string" && value.trim()) return value;
  if (typeof value === "number") return String(value);
  return fallback;
}

function publicProductPriceLabel(product: PublicMenuProduct | null): string {
  if (!product) return "Price pending";
  return isPricePending(product.basePrice)
    ? "Price pending"
    : `LKR ${Number(product.basePrice).toFixed(2)}`;
}

function exploreGroupFor(product: PublicMenuProduct): string {
  const category = (product.productCategory ?? "").toLowerCase();
  if (category.includes("sweet")) return "Sweets";
  if (category.includes("portion") || category.includes("date")) return "Portions (like dates)";
  if (category.includes("special")) return "Specials";
  return "Healthy Meals";
}

interface DailyItemDisplay {
  key: string;
  name: string;
  amount: string;
  product: PublicMenuProduct | null;
  imageMeal: Meal;
  priceLabel: string;
  categoryLabel: string;
}

interface ScrollState {
  canScrollLeft: boolean;
  canScrollRight: boolean;
  progress: number;
}

export interface LunchCatalogProps {
  /** Optional uploaded curry/dish/image updates, keyed by weekday id. */
  mealUpdates?: MealUpdateMap;
}

export function LunchCatalog({ mealUpdates }: LunchCatalogProps = {}) {
  const baseMenu = useMealMenu(mealUpdates);
  const {
    addMeal,
    addIngredient,
    openCart,
    menuLoading,
    menu: publicMenuData,
    productForMeal,
    productForIngredient,
  } = useCart();

  // Overlay Admin-managed product data (name, image, ingredients, nutrition,
  // and retail price via the cart product lookup) onto the supplied weekday
  // catalog. If Admin renames/edits a combo product, the customer UI follows
  // after the public menu refreshes.
  const menu = useMemo<Meal[]>(
    () =>
      baseMenu.map((meal) => {
        const product = productForMeal(meal);
        if (!product) return meal;
        return {
          ...meal,
          title: product.title || meal.title,
          imagePlaceholder: product.imageUrl ?? meal.imagePlaceholder,
          ingredients: productIngredients(product) ?? meal.ingredients,
          macros: {
            protein: macroString(product, "protein", meal.macros.protein),
            carbs: macroString(product, "carbs", meal.macros.carbs),
            fat: macroString(product, "fat", meal.macros.fat),
            calories: macroString(product, "calories", meal.macros.calories),
            vitamins: macroString(product, "vitamins", meal.macros.vitamins ?? "") || undefined,
            minerals: macroString(product, "minerals", meal.macros.minerals ?? "") || undefined,
          },
        };
      }),
    [baseMenu, productForMeal],
  );
  const [activeDayId, setActiveDayId] = useState(lunchMenu[0].id);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showExploreCategories, setShowExploreCategories] = useState(false);
  const [todayMealId, setTodayMealId] = useState(lunchMenu[0].id);
  const [todayIsWeekend, setTodayIsWeekend] = useState(false);
  const [scrollState, setScrollState] = useState<ScrollState>({
    canScrollLeft: false,
    canScrollRight: true,
    progress: 0,
  });

  const reduceMotion = Boolean(useReducedMotion());
  const scrollerRef = useRef<HTMLDivElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const selectedMeal = useMemo(
    () => menu.find((meal) => meal.id === selectedId) ?? null,
    [menu, selectedId],
  );

  useEffect(() => {
    const day = new Date().getDay();
    const weekend = day === 0 || day === 6;
    setTodayIsWeekend(weekend);
    setTodayMealId(weekend ? lunchMenu[0].id : lunchMenu[day - 1].id);
  }, []);

  const todayMeal = useMemo(
    () => menu.find((meal) => meal.id === todayMealId) ?? menu[0],
    [menu, todayMealId],
  );
  const todayProduct = productForMeal(todayMeal);
  const todayPriceLabel = menuLoading
    ? "Menu syncing"
    : !todayProduct
      ? "Price pending"
      : isPricePending(todayProduct.basePrice)
        ? "Price pending"
        : `LKR ${Number(todayProduct.basePrice).toFixed(2)}`;

  const dailyItems = useMemo<DailyItemDisplay[]>(() => {
    const items: DailyItemDisplay[] = [];
    const seen = new Set<string>();
    const publicProducts = publicMenuData?.products ?? [];

    const pushItem = (item: DailyItemDisplay) => {
      const key = item.name.trim().toLowerCase();
      if (!key || seen.has(key)) return;
      seen.add(key);
      items.push(item);
    };

    for (const ingredient of todayMeal.ingredients) {
      const product = productForIngredient(todayMeal, ingredient);
      // Once the public menu has loaded, hidden/deleted Admin products should
      // disappear from the purchasable daily-item cards.
      if (publicMenuData && !product) continue;
      pushItem({
        key: product?.id ?? `${todayMeal.id}-${ingredient.name}`,
        name: product?.title ?? ingredient.name,
        amount: product?.quantity ?? ingredient.amount,
        product,
        imageMeal: {
          ...todayMeal,
          imagePlaceholder: product?.imageUrl ?? todayMeal.imagePlaceholder,
        },
        priceLabel: publicProductPriceLabel(product),
        categoryLabel: product?.productCategory ?? "Daily item",
      });
    }

    for (const product of publicProducts) {
      const assignedToday =
        product.dayAssignment === todayMeal.day ||
        product.categoryName === todayMeal.day ||
        product.categorySlug === todayMeal.day.toLowerCase();
      const everyday =
        product.dayAssignment === "Everyday" || product.categorySlug === "everyday";
      if (!assignedToday && !everyday) continue;
      if (todayProduct && product.id === todayProduct.id) continue;

      const firstIngredient = productIngredients(product)?.[0];
      pushItem({
        key: product.id,
        name: product.title,
        amount: product.quantity ?? firstIngredient?.amount ?? "—",
        product,
        imageMeal: {
          ...todayMeal,
          id: product.id,
          imagePlaceholder: product.imageUrl ?? todayMeal.imagePlaceholder,
        },
        priceLabel: publicProductPriceLabel(product),
        categoryLabel: product.productCategory ?? (everyday ? "Everyday" : "Daily item"),
      });
    }

    return items;
  }, [productForIngredient, publicMenuData, todayMeal, todayProduct]);

  const exploreCategories = useMemo(() => {
    const publicProducts = publicMenuData?.products ?? [];
    const definitions = [
      {
        name: "Healthy Meals",
        description: "The Monday–Friday Lunch (Rice & Curry) catalog below.",
      },
      {
        name: "Specials",
        description: "Admin-published specials appear here automatically.",
      },
      {
        name: "Portions (like dates)",
        description: "Admin-published standalone portions appear here automatically.",
      },
      {
        name: "Sweets",
        description: "Admin-published sweet items appear here automatically.",
      },
    ] as const;

    return definitions.map((definition) => {
      const products = publicProducts.filter(
        (product) => exploreGroupFor(product) === definition.name,
      );
      return {
        ...definition,
        status: products.length > 0 ? `${products.length} item${products.length === 1 ? "" : "s"}` : "No items published yet",
        examples: products.slice(0, 3).map((product) => product.title).join(" · "),
      };
    });
  }, [publicMenuData]);

  const adminManagedProducts = useMemo(() => {
    const publicProducts = publicMenuData?.products ?? [];
    const catalogNames = new Set(
      baseMenu.flatMap((meal) => [
        meal.title.trim().toLowerCase(),
        ...meal.ingredients.map((ingredient) => ingredient.name.trim().toLowerCase()),
      ]),
    );

    return publicProducts.filter((product) => {
      const group = exploreGroupFor(product);
      return (
        product.dayAssignment === "Everyday" ||
        product.categorySlug === "everyday" ||
        group !== "Healthy Meals" ||
        !catalogNames.has(product.title.trim().toLowerCase())
      );
    });
  }, [baseMenu, publicMenuData]);

  const sharedTransition: Transition = reduceMotion
    ? { duration: 0 }
    : { type: "spring", stiffness: 260, damping: 30, mass: 0.9 };

  const revealTransition: Transition = reduceMotion
    ? { duration: 0 }
    : { duration: 0.32, ease: "easeOut" };

  const openMeal = useCallback((id: string, trigger: HTMLElement | null) => {
    returnFocusRef.current = trigger;
    setActiveDayId(id);
    setSelectedId(id);
  }, []);

  const closeMeal = useCallback(() => {
    setSelectedId(null);
    window.requestAnimationFrame(() => returnFocusRef.current?.focus());
  }, []);

  const updateScrollState = useCallback(() => {
    const element = scrollerRef.current;
    if (!element) return;

    const maxScroll = Math.max(element.scrollWidth - element.clientWidth, 0);
    const progress = maxScroll === 0 ? 1 : element.scrollLeft / maxScroll;

    setScrollState({
      canScrollLeft: element.scrollLeft > 8,
      canScrollRight: element.scrollLeft < maxScroll - 8,
      progress: Math.min(1, Math.max(0, progress)),
    });
  }, []);

  useEffect(() => {
    updateScrollState();

    const element = scrollerRef.current;
    if (!element) return;

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", updateScrollState);
      return () => window.removeEventListener("resize", updateScrollState);
    }

    const observer = new ResizeObserver(updateScrollState);
    observer.observe(element);
    element.querySelectorAll("[data-meal-card]").forEach((card) => {
      observer.observe(card);
    });

    return () => observer.disconnect();
  }, [updateScrollState]);

  useEffect(() => {
    if (!selectedId) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    const focusTimer = window.setTimeout(() => {
      closeButtonRef.current?.focus();
    }, reduceMotion ? 0 : 120);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        closeMeal();
        return;
      }

      if (event.key !== "Tab" || !dialogRef.current) return;

      const focusable = Array.from(
        dialogRef.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.offsetParent !== null);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);

    return () => {
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", handleKeyDown);
      document.body.style.overflow = previousOverflow;
    };
  }, [closeMeal, reduceMotion, selectedId]);

  const scrollByCard = useCallback(
    (direction: 1 | -1) => {
      const element = scrollerRef.current;
      if (!element) return;

      const firstCard = element.querySelector<HTMLElement>("[data-meal-card]");
      const computedStyle = window.getComputedStyle(element);
      const parsedGap = Number.parseFloat(computedStyle.columnGap);
      const gap = Number.isFinite(parsedGap) ? parsedGap : 20;
      const distance = ((firstCard?.offsetWidth ?? 300) + gap) * direction;

      element.scrollBy({
        left: distance,
        behavior: reduceMotion ? "auto" : "smooth",
      });
    },
    [reduceMotion],
  );

  const scrollToMeal = useCallback(
    (id: string) => {
      const element = scrollerRef.current;
      const card = document.getElementById(`meal-card-${id}`);
      if (!element || !card) return;

      setActiveDayId(id);

      if (element.scrollWidth > element.clientWidth) {
        const elementRect = element.getBoundingClientRect();
        const cardRect = card.getBoundingClientRect();
        const left =
          element.scrollLeft +
          cardRect.left -
          elementRect.left -
          (element.clientWidth - cardRect.width) / 2;

        element.scrollTo({
          left: Math.max(0, left),
          behavior: reduceMotion ? "auto" : "smooth",
        });
      } else {
        card.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "nearest",
          inline: "center",
        });
      }

      card.focus({ preventScroll: true });
    },
    [reduceMotion],
  );

  const handleCardKeyDown = (
    event: ReactKeyboardEvent<HTMLElement>,
    id: string,
  ) => {
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    openMeal(id, event.currentTarget);
  };

  const handleOverlayClick = (event: ReactMouseEvent<HTMLDivElement>) => {
    if (event.target === event.currentTarget) closeMeal();
  };

  const orderTodayCombo = useCallback(() => {
    addMeal(todayMeal, 1);
    openCart();
  }, [addMeal, openCart, todayMeal]);

  const orderIndividualItem = useCallback(
    (item: DailyItemDisplay) => {
      if (!item.product) {
        addIngredient(todayMeal, { name: item.name, amount: item.amount }, 1);
        return;
      }

      const ingredientProduct = productForIngredient(todayMeal, {
        name: item.product.title,
        amount: item.amount,
      });

      if (ingredientProduct?.id === item.product.id) {
        addIngredient(
          todayMeal,
          { name: item.product.title, amount: item.amount },
          1,
        );
      } else {
        addMeal(
          {
            id: item.product.id,
            day: item.product.categoryName,
            title: item.product.title,
            imagePlaceholder: item.product.imageUrl ?? todayMeal.imagePlaceholder,
          },
          1,
        );
      }
      openCart();
    },
    [addIngredient, addMeal, openCart, productForIngredient, todayMeal],
  );

  const orderPublicProduct = useCallback(
    (product: PublicMenuProduct) => {
      addMeal(
        {
          id: product.id,
          day: product.categoryName,
          title: product.title,
          imagePlaceholder: product.imageUrl ?? todayMeal.imagePlaceholder,
        },
        1,
      );
      openCart();
    },
    [addMeal, openCart, todayMeal.imagePlaceholder],
  );

  return (
    <LayoutGroup id="macrobox-lunch-catalog">
      <main className="relative min-h-screen overflow-hidden bg-[#DCE6DA] px-4 py-6 selection:bg-[#8FBC8F]/30 sm:px-8 sm:py-10 lg:px-12 lg:py-12">
        <div className="pointer-events-none absolute -left-24 -top-28 h-80 w-80 rounded-full bg-[#7CA982]/25 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-40 right-[-8rem] h-[28rem] w-[28rem] rounded-full bg-[#BED0BA]/70 blur-3xl" />
        <div className="pointer-events-none absolute right-[18%] top-[8%] h-28 w-28 rounded-full border border-white/60 shadow-[inset_8px_8px_18px_rgba(209,217,211,0.5),12px_12px_28px_rgba(255,255,255,0.8)]" />

        <div className="relative mx-auto max-w-[1500px]">
          <header className="flex items-start justify-between gap-4">
            <div
              className={cn(
                "flex items-center rounded-[1.5rem] border border-white/80 bg-[#F5F8F2] p-2",
                RAISED_SMALL,
              )}
            >
              <Image
                src="/macrobox_primary_cutout.png"
                alt="MacroBox — Healthy Diet Meals"
                width={104}
                height={104}
                priority
                className="h-20 w-20 object-contain sm:h-24 sm:w-24"
              />
            </div>

            <div
              className={cn(
                "rounded-full border border-white/80 bg-[#DCE6DA] px-4 py-3 text-right sm:px-6",
                RAISED_SMALL,
              )}
            >
              <p className="text-[10px] font-semibold tracking-[0.06em] text-[#7CA982] sm:text-xs">
                {categoryName}
              </p>
              <p className="mt-0.5 text-[10px] font-medium text-[#53675A] sm:text-xs">
                {menu[0].day} – {menu[menu.length - 1].day}
              </p>
            </div>
          </header>

          <section className="mt-10 max-w-6xl sm:mt-14">
            <div className="mb-4 flex items-center gap-3">
              <span className="h-2 w-2 rounded-full bg-[#8FBC8F] shadow-[0_0_0_5px_rgba(143,188,143,0.16)]" />
              <p className="text-[11px] font-semibold tracking-[0.24em] text-[#53675A] uppercase">
                Weekday catalog
              </p>
            </div>
            <h1 className="font-display text-[clamp(2.6rem,6vw,5.25rem)] leading-[0.95] font-bold tracking-[-0.06em] text-[#2C3E50] text-balance">
              Lunch{" "}
              <span className="mt-1 block text-[#7CA982] sm:mt-0 sm:inline">
                (Rice &amp; Curry)
              </span>
            </h1>
            <p className="mt-5 max-w-xl text-sm leading-7 text-[#51645B] sm:text-base">
              Select a day to view its ingredients and macro breakdown.
            </p>
          </section>

          <section aria-labelledby="today-main-combo-title" className="mt-10 sm:mt-14">
            <div
              className={cn(
                "grid overflow-hidden rounded-[2rem] border border-white/80 bg-[#F7F6F2] lg:grid-cols-[1.02fr_0.98fr]",
                RAISED_LARGE,
              )}
            >
              <div className="relative min-h-[280px] lg:min-h-full">
                <MealImage
                  meal={todayMeal}
                  layoutId={`today-meal-image-${todayMeal.id}`}
                  transition={sharedTransition}
                  sizes="(max-width: 1024px) 100vw, 50vw"
                  className="h-full min-h-[280px] rounded-none lg:min-h-[430px]"
                  priority
                />
                <span
                  className={cn(
                    "absolute left-4 top-4 rounded-full px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.16em] text-[#22301f]",
                    ACCENT_SURFACE,
                    RAISED_TINY,
                  )}
                >
                  {todayIsWeekend ? "Next weekday combo" : "Today's Main Combo"}
                </span>
              </div>

              <div className="p-5 sm:p-7 lg:p-8">
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5f7f66]">
                  {todayIsWeekend ? "Next available weekday" : "Available today"}
                </p>
                <h2
                  id="today-main-combo-title"
                  className="mt-3 font-display text-3xl font-bold leading-tight text-[#2C3E50] sm:text-4xl"
                >
                  {todayMeal.day} — {todayMeal.title}
                </h2>
                <p className="mt-2 text-sm font-semibold text-[#53675A]">
                  {categoryName} · {todayPriceLabel}
                </p>

                <div className="mt-5 grid grid-cols-2 gap-2 text-center sm:grid-cols-4">
                  {[
                    ["Protein", todayMeal.macros.protein],
                    ["Carbs", todayMeal.macros.carbs],
                    ["Fat", todayMeal.macros.fat],
                    ["Calories", todayMeal.macros.calories],
                  ].map(([label, value]) => (
                    <div key={label} className={cn("rounded-2xl bg-[#DCE6DA] px-2 py-3", INSET_TINY)}>
                      <p className="text-[10px] font-bold uppercase tracking-wider text-[#6f7a74]">{label}</p>
                      <p className="mt-1 font-display text-sm font-bold text-[#2C3E50]">{value}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  {todayMeal.ingredients.map((ingredient) => (
                    <span
                      key={`${ingredient.name}-${ingredient.amount}`}
                      className={cn("rounded-full bg-[#DCE6DA] px-3 py-1.5 text-xs font-semibold", INSET_TINY)}
                    >
                      {ingredient.name} · {ingredient.amount}
                    </span>
                  ))}
                </div>

                <div className="mt-6 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={orderTodayCombo}
                    className={cn(
                      "rounded-2xl px-5 py-3 text-sm font-bold text-[#22301f]",
                      ACCENT_SURFACE,
                      RAISED_SMALL,
                      PRESSED_ON_ACTIVE,
                      FOCUS_RING,
                    )}
                  >
                    Online Order
                  </button>
                  <a
                    href={CUSTOMER_CONTACT.phoneHref}
                    className={cn(
                      "rounded-2xl bg-[#F7F6F2] px-5 py-3 text-sm font-bold text-[#3d4a42]",
                      RAISED_SMALL,
                      PRESSED_ON_ACTIVE,
                      FOCUS_RING,
                    )}
                  >
                    Call {CUSTOMER_CONTACT.phoneDisplay}
                  </a>
                  <button
                    type="button"
                    onClick={(event) => openMeal(todayMeal.id, event.currentTarget)}
                    className={cn(
                      "rounded-2xl bg-[#F7F6F2] px-5 py-3 text-sm font-bold text-[#3d4a42]",
                      RAISED_SMALL,
                      PRESSED_ON_ACTIVE,
                      FOCUS_RING,
                    )}
                  >
                    View details
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section aria-labelledby="individual-daily-items-title" className="mt-12">
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#5f7f66]">
                  {todayMeal.day} selection
                </p>
                <h2 id="individual-daily-items-title" className="mt-2 font-display text-3xl font-bold text-[#2C3E50]">
                  Individual Daily Items
                </h2>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-[#51645B]">
                  Each card is a separate item from today&apos;s combo. Online Order adds only that item to your
                  cart and opens checkout.
                </p>
              </div>
              <span className={cn("rounded-full bg-[#DCE6DA] px-3 py-1.5 text-xs font-bold", RAISED_TINY)}>
                {dailyItems.length} items
              </span>
            </div>

            <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
              {dailyItems.map((item, index) => (
                <article
                  key={item.key}
                  className={cn("overflow-hidden rounded-[1.5rem] border border-white/80 bg-[#F7F6F2]", RAISED_SMALL)}
                >
                  <MealImage
                    meal={item.imageMeal}
                    layoutId={`daily-item-image-${item.key}-${index}`}
                    transition={sharedTransition}
                    sizes="(max-width: 640px) 100vw, (max-width: 1280px) 33vw, 20vw"
                    className="h-36 rounded-none"
                  />
                  <div className="p-4">
                    <h3 className="font-display text-base font-bold leading-snug text-[#2C3E50]">{item.name}</h3>
                    <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                      {item.amount} · {item.categoryLabel}
                    </p>
                    <p className="mt-3 text-xs leading-5 text-[#6f7a74]">
                      Available separately. {item.priceLabel}.
                    </p>
                    <button
                      type="button"
                      onClick={() => orderIndividualItem(item)}
                      className={cn(
                        "mt-4 w-full rounded-xl px-3 py-2.5 text-xs font-bold text-[#22301f]",
                        ACCENT_SURFACE,
                        RAISED_TINY,
                        PRESSED_ON_ACTIVE,
                        FOCUS_RING,
                      )}
                    >
                      Online Order
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </section>

          <section aria-label="Order actions" className="mt-10 grid gap-3 sm:grid-cols-2">
            <button
              type="button"
              onClick={orderTodayCombo}
              className={cn(
                "rounded-[1.5rem] px-5 py-4 text-left text-[#22301f]",
                ACCENT_SURFACE,
                RAISED_SMALL,
                PRESSED_ON_ACTIVE,
                FOCUS_RING,
              )}
            >
              <span className="block font-display text-lg font-bold">Online Order</span>
              <span className="mt-1 block text-sm">Add today&apos;s combo to cart and continue to checkout.</span>
            </button>
            <a
              href={CUSTOMER_CONTACT.phoneHref}
              className={cn(
                "rounded-[1.5rem] bg-[#F7F6F2] px-5 py-4 text-left text-[#3d4a42]",
                RAISED_SMALL,
                PRESSED_ON_ACTIVE,
                FOCUS_RING,
              )}
            >
              <span className="block font-display text-lg font-bold">Call</span>
              <span className="mt-1 block text-sm">Order by phone: {CUSTOMER_CONTACT.phoneDisplay}</span>
            </a>
          </section>

          <div className="mt-12">
            <button
              type="button"
              onClick={() => setShowExploreCategories((current) => !current)}
              aria-expanded={showExploreCategories}
              aria-controls="explore-categories-panel"
              className={cn(
                "flex w-full items-center justify-between gap-4 rounded-[1.5rem] border border-white/80 bg-[#F7F6F2] px-5 py-4 text-left",
                RAISED_SMALL,
                PRESSED_ON_ACTIVE,
                FOCUS_RING,
              )}
            >
              <span>
                <span className="block font-display text-lg font-bold text-[#2C3E50]">Explore Categories</span>
                <span className="mt-1 block text-sm text-[#51645B]">
                  Reveal Healthy Meals, Specials, Portions, and Sweets.
                </span>
              </span>
              <span className={cn("rounded-full px-3 py-1.5 text-xs font-bold", ACCENT_SURFACE)}>
                {showExploreCategories ? "Hide" : "Explore"}
              </span>
            </button>

            {showExploreCategories ? (
              <>
                <div id="explore-categories-panel" className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                  {exploreCategories.map((category) => (
                    <article
                      key={category.name}
                      className={cn("rounded-[1.5rem] border border-white/80 bg-[#F7F6F2] p-4", RAISED_SMALL)}
                    >
                      <h3 className="font-display text-base font-bold text-[#2C3E50]">{category.name}</h3>
                      <p className="mt-2 min-h-10 text-sm leading-6 text-[#51645B]">{category.description}</p>
                      {category.examples ? (
                        <p className="mt-2 line-clamp-2 text-xs leading-5 text-[#6f7a74]">{category.examples}</p>
                      ) : null}
                      <p className={cn("mt-3 inline-flex rounded-full px-3 py-1 text-[11px] font-bold", ACCENT_SOFT_SURFACE)}>
                        {category.status}
                      </p>
                    </article>
                  ))}
                </div>

                {adminManagedProducts.length > 0 ? (
                  <div className="mt-6">
                    <h3 className="font-display text-lg font-bold text-[#2C3E50]">More Products</h3>
                    <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                      {adminManagedProducts.map((product) => {
                        const firstIngredient = productIngredients(product)?.[0];
                        return (
                          <article
                            key={product.id}
                            className={cn("overflow-hidden rounded-[1.5rem] border border-white/80 bg-[#F7F6F2]", RAISED_SMALL)}
                          >
                            <MealImage
                              meal={{
                                ...todayMeal,
                                id: product.id,
                                title: product.title,
                                imagePlaceholder: product.imageUrl ?? todayMeal.imagePlaceholder,
                              }}
                              layoutId={`admin-product-image-${product.id}`}
                              transition={sharedTransition}
                              sizes="(max-width: 640px) 100vw, 25vw"
                              className="h-32 rounded-none"
                            />
                            <div className="p-4">
                              <h4 className="font-display text-base font-bold text-[#2C3E50]">{product.title}</h4>
                              <p className="mt-1 text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                                {product.dayAssignment} · {product.productCategory ?? exploreGroupFor(product)}
                              </p>
                              <p className="mt-2 text-xs text-[#6f7a74]">
                                {product.quantity ?? firstIngredient?.amount ?? "Quantity not set"} · {publicProductPriceLabel(product)}
                              </p>
                              <button
                                type="button"
                                onClick={() => orderPublicProduct(product)}
                                className={cn(
                                  "mt-4 w-full rounded-xl px-3 py-2.5 text-xs font-bold text-[#22301f]",
                                  ACCENT_SURFACE,
                                  RAISED_TINY,
                                  PRESSED_ON_ACTIVE,
                                  FOCUS_RING,
                                )}
                              >
                                Online Order
                              </button>
                            </div>
                          </article>
                        );
                      })}
                    </div>
                  </div>
                ) : null}
              </>
            ) : null}
          </div>

          <nav
            aria-label="Weekday meals"
            className={cn("mt-7 flex flex-wrap gap-2.5", !showExploreCategories && "hidden")}
          >
            {menu.map((meal) => {
              const isActive = activeDayId === meal.id;

              return (
                <motion.button
                  key={meal.id}
                  type="button"
                  aria-label={`Jump to ${meal.day} meal`}
                  aria-pressed={isActive}
                  onClick={() => scrollToMeal(meal.id)}
                  whileHover={reduceMotion ? undefined : { y: -2 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.96 }}
                  className={cn(
                    "rounded-full border px-4 py-2.5 text-xs font-semibold transition-[box-shadow] duration-200 sm:px-5",
                    isActive
                      ? ACCENT_ACTIVE_BUTTON
                      : cn(
                          "border-white/70 bg-[#DCE6DA] text-[#2C3E50] hover:text-[#7CA982]",
                          RAISED_TINY,
                        ),
                    PRESSED_ON_ACTIVE,
                    FOCUS_RING,
                  )}
                >
                  {meal.day}
                </motion.button>
              );
            })}
          </nav>

          <motion.div
            ref={scrollerRef}
            layoutScroll
            onScroll={updateScrollState}
            className={
              showExploreCategories
                ? "-mx-4 mt-6 flex snap-x snap-mandatory gap-5 overflow-x-auto px-4 pt-3 pb-8 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:-mx-8 sm:px-8 lg:mx-0 lg:grid lg:grid-cols-3 lg:gap-6 lg:overflow-visible lg:px-0 lg:pb-4 xl:grid-cols-5"
                : "hidden"
            }
          >
            {menu.map((meal, index) => (
              <motion.article
                key={meal.id}
                id={`meal-card-${meal.id}`}
                data-meal-card
                data-meal-id={meal.id}
                data-meal-image={meal.imagePlaceholder}
                role="button"
                tabIndex={0}
                aria-label={`View details for ${meal.day}: ${meal.title}`}
                onClick={(event) => openMeal(meal.id, event.currentTarget)}
                onKeyDown={(event) => handleCardKeyDown(event, meal.id)}
                layoutId={`meal-shell-${meal.id}`}
                transition={sharedTransition}
                whileHover={reduceMotion ? undefined : { y: -7, scale: 1.01 }}
                whileTap={reduceMotion ? undefined : { y: 0, scale: 0.985 }}
                className={cn(
                  "group relative flex w-[82vw] max-w-[340px] min-w-[270px] shrink-0 snap-center cursor-pointer flex-col rounded-[2rem] border bg-[#DCE6DA] p-3.5 text-left sm:w-[330px] lg:w-auto lg:max-w-none lg:min-w-0",
                  activeDayId === meal.id
                    ? "border-[#8FBC8F]/70"
                    : "border-white/80",
                  RAISED_LARGE,
                  PRESSED_ON_ACTIVE,
                  FOCUS_RING,
                )}
              >
                <div className="relative">
                  <MealImage
                    meal={meal}
                    layoutId={`meal-image-${meal.id}`}
                    sizes="(max-width: 640px) 82vw, (max-width: 1280px) 330px, 260px"
                    transition={sharedTransition}
                    className="aspect-[4/3] w-full"
                    priority={index === 0}
                  />
                  <div
                    className={cn(
                      "absolute -bottom-4 right-4 flex h-12 w-12 items-center justify-center rounded-2xl border border-white/80 bg-[#DCE6DA] font-display text-sm font-bold text-[#7CA982]",
                      RAISED_TINY,
                    )}
                  >
                    {String(index + 1).padStart(2, "0")}
                  </div>
                </div>

                <motion.div layout="position" className="flex flex-1 flex-col px-1.5 pt-7">
                  <motion.h2
                    layoutId={`meal-day-${meal.id}`}
                    transition={sharedTransition}
                    className="font-display text-2xl font-bold tracking-[-0.04em] text-[#2C3E50]"
                  >
                    {meal.day}
                  </motion.h2>
                  <motion.p
                    layoutId={`meal-title-${meal.id}`}
                    transition={sharedTransition}
                    className="mt-1 line-clamp-1 text-xs font-medium text-[#53675A]"
                  >
                    {meal.title}
                  </motion.p>

                  <div
                    className={cn(
                      "mt-4 rounded-2xl border border-white/60 bg-[#CFDDCC] p-3",
                      INSET_SMALL,
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-[9px] font-semibold tracking-[0.14em] text-[#53675A] uppercase">
                        Ingredients
                      </p>
                      <span className="text-[9px] font-semibold text-[#7CA982]">
                        {meal.ingredients.length} items
                      </span>
                    </div>
                    <ul className="mt-2 space-y-1.5">
                      {meal.ingredients.map((ingredient) => (
                        <li
                          key={`${meal.id}-${ingredient.name}`}
                          className="flex items-start justify-between gap-2 text-[10px] leading-snug text-[#42545B]"
                        >
                          <span className="flex min-w-0 gap-1.5">
                            <span
                              className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-[#7CA982]"
                              aria-hidden="true"
                            />
                            <span className="min-w-0 break-words">
                              {ingredient.name}
                            </span>
                          </span>
                          <span
                            className={cn(
                              "shrink-0 rounded-full bg-[#D4E0D0] px-1.5 py-0.5 text-[9px] font-semibold text-[#7CA982]",
                              INSET_TINY,
                            )}
                          >
                            {ingredient.amount}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {macroDetails.map(({ key: macroKey, label }) => (
                      <div
                        key={macroKey}
                        className={cn(
                          "rounded-xl border border-white/60 bg-[#CFDDCC] px-2.5 py-2",
                          INSET_TINY,
                        )}
                      >
                        <p className="text-[8px] font-semibold tracking-[0.12em] text-[#53675A] uppercase">
                          {label}
                        </p>
                        <p className="mt-0.5 font-display text-[11px] font-bold whitespace-nowrap text-[#2C3E50] sm:text-xs">
                          {meal.macros[macroKey]}
                        </p>
                        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[#c3d1bf] shadow-[inset_2px_2px_4px_#aebfaa,inset_-2px_-2px_4px_#f8fbf4]">
                          <div
                            className="h-full rounded-full bg-[#8FBC8F]"
                            style={{ width: `${macroProgress(macroKey, meal.macros[macroKey])}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className={cn(
                      "mt-3 flex items-center justify-between gap-3 rounded-2xl bg-[#D4E0D0] px-3 py-2.5",
                      INSET_SMALL,
                    )}
                  >
                    <span className="text-[9px] font-semibold tracking-[0.12em] text-[#53675A] uppercase">
                      Total calories
                    </span>
                    <span className="font-display text-xs font-bold whitespace-nowrap text-[#2C3E50] sm:text-sm">
                      {meal.macros.calories}
                    </span>
                  </div>

                  <span
                    className={cn(
                      "mt-auto flex w-full items-center justify-between gap-3 rounded-2xl border border-white/70 bg-[#DCE6DA] px-4 py-3 text-sm font-semibold text-[#2C3E50] transition-colors duration-200 group-hover:bg-[#E5EEE1] sm:mt-4",
                      RAISED_SMALL,
                      INNER_PRESSED_ON_ACTIVE,
                    )}
                  >
                    View Details
                    <span
                      className={cn(
                        "flex h-8 w-8 items-center justify-center rounded-xl",
                        ACCENT_SOFT_SURFACE,
                        ACCENT_TEXT,
                      )}
                    >
                      <ArrowIcon />
                    </span>
                  </span>
                </motion.div>
              </motion.article>
            ))}
          </motion.div>

          <div
            className={cn(
              "mt-1 flex items-center justify-between gap-4 lg:hidden",
              !showExploreCategories && "hidden",
            )}
          >
            <p className="text-[10px] font-semibold tracking-[0.16em] text-[#53675A] uppercase">
              Swipe to explore
            </p>
            <div className="flex items-center gap-3">
              <div
                className={cn(
                  "h-2 w-24 overflow-hidden rounded-full bg-[#C8D7C5]",
                  INSET_SMALL,
                )}
                aria-hidden="true"
              >
                <div
                  className={cn(
                    "h-full rounded-full transition-[width] duration-300",
                    ACCENT_SURFACE,
                  )}
                  style={{
                    width: `${Math.max(16, scrollState.progress * 100)}%`,
                  }}
                />
              </div>
              <div
                className={cn(
                  "flex items-center gap-2 rounded-full p-1.5",
                  RAISED_SMALL,
                )}
              >
                <motion.button
                  type="button"
                  aria-label="Scroll to previous meal"
                  onClick={() => scrollByCard(-1)}
                  disabled={!scrollState.canScrollLeft}
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE6DA] transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
                    ACCENT_TEXT,
                    RAISED_TINY,
                    PRESSED_ON_ACTIVE,
                    FOCUS_RING,
                  )}
                >
                  <ArrowIcon direction="left" />
                </motion.button>
                <motion.button
                  type="button"
                  aria-label="Scroll to next meal"
                  onClick={() => scrollByCard(1)}
                  disabled={!scrollState.canScrollRight}
                  whileTap={reduceMotion ? undefined : { scale: 0.9 }}
                  className={cn(
                    "flex h-9 w-9 items-center justify-center rounded-full bg-[#DCE6DA] transition-opacity disabled:cursor-not-allowed disabled:opacity-40",
                    ACCENT_TEXT,
                    RAISED_TINY,
                    PRESSED_ON_ACTIVE,
                    FOCUS_RING,
                  )}
                >
                  <ArrowIcon />
                </motion.button>
              </div>
            </div>
          </div>
        </div>
      </main>

      <AnimatePresence>
        {selectedMeal && (
          <motion.div
            className="fixed inset-0 z-50 overflow-y-auto bg-[#2C3E50]/35 p-3 backdrop-blur-md sm:p-6 lg:p-8"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.22 }}
            onClick={handleOverlayClick}
          >
            <motion.section
              ref={dialogRef}
              role="dialog"
              aria-modal="true"
              aria-live="polite"
              data-meal-id={selectedMeal.id}
              data-meal-image={selectedMeal.imagePlaceholder}
              aria-labelledby={`meal-dialog-title-${selectedMeal.id}`}
              layoutId={`meal-shell-${selectedMeal.id}`}
              transition={sharedTransition}
              className={cn(
                "relative mx-auto flex min-h-full w-full max-w-6xl flex-col overflow-hidden rounded-[2rem] border border-white/80 bg-[#DCE6DA] p-4 sm:rounded-[2.5rem] sm:p-6 lg:p-8",
                RAISED_LARGE,
              )}
            >
              <div className="relative z-20 mb-5 flex items-center justify-between gap-3">
                <div
                  className={cn(
                    "rounded-full px-4 py-2.5 text-[10px] font-semibold tracking-[0.06em]",
                    ACCENT_SOFT_SURFACE,
                    ACCENT_TEXT,
                    RAISED_SMALL,
                  )}
                >
                  {categoryName}
                </div>
                <motion.button
                  ref={closeButtonRef}
                  type="button"
                  aria-label="Close meal details"
                  onClick={closeMeal}
                  whileHover={reduceMotion ? undefined : { scale: 1.03 }}
                  whileTap={reduceMotion ? undefined : { scale: 0.94 }}
                  className={cn(
                    "flex items-center gap-2 rounded-full border border-white/80 bg-[#DCE6DA] px-4 py-2.5 text-xs font-semibold text-[#2C3E50]",
                    RAISED_SMALL,
                    PRESSED_ON_ACTIVE,
                    FOCUS_RING,
                  )}
                >
                  Close
                  <CloseIcon />
                </motion.button>
              </div>

              <div className="grid flex-1 gap-6 lg:grid-cols-[minmax(0,1.05fr)_minmax(0,0.95fr)] lg:gap-8">
                <div className="relative min-h-[280px] sm:min-h-[390px] lg:min-h-[610px]">
                  <MealImage
                    meal={selectedMeal}
                    layoutId={`meal-image-${selectedMeal.id}`}
                    sizes="(max-width: 1024px) 100vw, 52vw"
                    transition={sharedTransition}
                    className="absolute inset-0 h-full w-full rounded-[1.75rem] sm:rounded-[2rem]"
                    priority
                  />
                  <div
                    className={cn(
                      "absolute top-4 left-4 rounded-full border border-[#8FBC8F]/70 px-4 py-2.5 text-[10px] font-semibold tracking-[0.16em] text-[#2C3E50] uppercase",
                      ACCENT_SURFACE,
                      INSET_TINY,
                    )}
                  >
                    {selectedMeal.day}
                  </div>
                </div>

                <motion.div
                  layout="position"
                  initial={reduceMotion ? false : { opacity: 0, y: 14 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ ...revealTransition, delay: reduceMotion ? 0 : 0.08 }}
                  className="flex flex-col"
                >
                  <p
                    className={cn(
                      "text-[10px] font-semibold tracking-[0.22em] uppercase",
                      ACCENT_TEXT,
                    )}
                  >
                    Meal details
                  </p>
                  <motion.h2
                    id={`meal-dialog-title-${selectedMeal.id}`}
                    layoutId={`meal-day-${selectedMeal.id}`}
                    transition={sharedTransition}
                    className="mt-2 font-display text-[clamp(2.7rem,7vw,5rem)] leading-[0.95] font-bold tracking-[-0.06em] text-[#2C3E50]"
                  >
                    {selectedMeal.day}
                  </motion.h2>
                  <motion.p
                    layoutId={`meal-title-${selectedMeal.id}`}
                    transition={sharedTransition}
                    className="mt-3 text-sm font-medium text-[#53675A] sm:text-base"
                  >
                    {selectedMeal.title}
                  </motion.p>

                  <div className="my-6 h-px w-full bg-gradient-to-r from-[#D9E2D9] via-white to-transparent" />

                  <section aria-labelledby="ingredients-heading">
                    <div className="flex items-center justify-between gap-3">
                      <h3
                        id="ingredients-heading"
                        className="font-display text-lg font-bold tracking-[-0.03em] text-[#2C3E50]"
                      >
                        Ingredients
                      </h3>
                      <span
                        className={cn(
                          "rounded-full px-3 py-1 text-[10px] font-semibold tracking-[0.12em] uppercase",
                          ACCENT_SOFT_SURFACE,
                          ACCENT_TEXT,
                        )}
                      >
                        {selectedMeal.ingredients.length} items
                      </span>
                    </div>

                    <ul className="mt-4 grid grid-cols-1 gap-2.5">
                      {selectedMeal.ingredients.map((ingredient, index) => (
                        <motion.li
                          key={`${selectedMeal.id}-${ingredient.name}`}
                          initial={reduceMotion ? false : { opacity: 0, y: 8 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{
                            duration: reduceMotion ? 0 : 0.25,
                            delay: reduceMotion ? 0 : 0.1 + index * 0.035,
                          }}
                          className={cn(
                            "flex items-center justify-between gap-3 rounded-2xl border border-white/70 bg-[#DCE6DA] px-3.5 py-3",
                            RAISED_TINY,
                          )}
                        >
                          <span className="flex min-w-0 items-center gap-2.5">
                            <CheckIcon />
                            <span className="text-xs leading-snug font-medium break-words text-[#42545B] sm:text-[13px]">
                              {ingredient.name}
                            </span>
                          </span>
                          <span className="shrink-0 rounded-full bg-[#D4E0D0] px-2.5 py-1 text-[11px] font-semibold text-[#7CA982] shadow-[inset_2px_2px_5px_#B4C3B0,inset_-2px_-2px_5px_#F8FBF4]">
                            {ingredient.amount}
                          </span>
                        </motion.li>
                      ))}
                    </ul>
                  </section>

                  <section aria-labelledby="macros-heading" className="mt-7">
                    <h3
                      id="macros-heading"
                      className="font-display text-lg font-bold tracking-[-0.03em] text-[#2C3E50]"
                    >
                      Macros
                    </h3>
                    <div className="mt-4 grid grid-cols-2 gap-3">
                      {macroDetails.map(({ key, label }) => (
                        <div
                          key={key}
                          className={cn(
                            "relative overflow-hidden rounded-[1.4rem] border border-white/60 bg-[#CFDDCC] p-4",
                            INSET_MEDIUM,
                          )}
                        >
                          <div className={cn("flex items-center gap-2", ACCENT_TEXT)}>
                            <MacroIcon kind={key} />
                            <span className="text-[10px] font-semibold tracking-[0.14em] uppercase">
                              {label}
                            </span>
                          </div>
                          <p className="mt-3 font-display text-xl leading-none font-bold tracking-[-0.04em] text-[#2C3E50] sm:text-2xl">
                            {selectedMeal.macros[key]}
                          </p>
                          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-[#bccbb8] shadow-[inset_3px_3px_6px_#9fb19b,inset_-3px_-3px_6px_#f4faf0]">
                            <div
                              className={cn("h-full rounded-full", ACCENT_SURFACE)}
                              style={{ width: `${macroProgress(key, selectedMeal.macros[key])}%` }}
                            />
                          </div>
                          <div
                            className={cn(
                              "absolute right-3 bottom-3 h-1.5 w-10 rounded-full opacity-35 shadow-[inset_1px_1px_2px_rgba(100,130,100,0.25)]",
                              ACCENT_SURFACE,
                            )}
                          />
                        </div>
                      ))}
                    </div>
                    {selectedMeal.macros.vitamins || selectedMeal.macros.minerals ? (
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {selectedMeal.macros.vitamins ? (
                          <div className={cn("rounded-2xl bg-[#DCE6DA] px-4 py-3", INSET_TINY)}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6f7a74]">Vitamins</p>
                            <p className="mt-1 text-sm font-semibold">{selectedMeal.macros.vitamins}</p>
                          </div>
                        ) : null}
                        {selectedMeal.macros.minerals ? (
                          <div className={cn("rounded-2xl bg-[#DCE6DA] px-4 py-3", INSET_TINY)}>
                            <p className="text-[10px] font-bold uppercase tracking-wider text-[#6f7a74]">Minerals</p>
                            <p className="mt-1 text-sm font-semibold">{selectedMeal.macros.minerals}</p>
                          </div>
                        ) : null}
                      </div>
                    ) : null}
                  </section>

                  <div className="mt-8 flex flex-wrap gap-3">
                    <motion.button
                      type="button"
                      disabled={menuLoading}
                      onClick={() => addMeal(selectedMeal, 1)}
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-[#8FBC8F] px-6 py-3.5 text-sm font-bold text-[#22301f] disabled:opacity-55",
                        RAISED_SMALL,
                        PRESSED_ON_ACTIVE,
                        FOCUS_RING,
                      )}
                    >
                      {menuLoading ? "Syncing menu…" : "Add to cart"}
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={openCart}
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-[#DCE6DA] px-6 py-3.5 text-sm font-semibold text-[#2C3E50]",
                        RAISED_SMALL,
                        PRESSED_ON_ACTIVE,
                        FOCUS_RING,
                      )}
                    >
                      View cart
                    </motion.button>
                    <motion.button
                      type="button"
                      onClick={closeMeal}
                      whileHover={reduceMotion ? undefined : { y: -2 }}
                      whileTap={reduceMotion ? undefined : { scale: 0.98 }}
                      className={cn(
                        "flex items-center justify-center gap-2 rounded-2xl border border-white/70 bg-[#DCE6DA] px-6 py-3.5 text-sm font-semibold text-[#2C3E50]",
                        RAISED_SMALL,
                        PRESSED_ON_ACTIVE,
                        FOCUS_RING,
                      )}
                    >
                      <ArrowIcon direction="left" />
                      Back to week
                    </motion.button>
                  </div>
                </motion.div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </LayoutGroup>
  );
}
