/**
 * Exact supplied weekday catalog data, reused for the local live engine.
 * Prices are intentionally not included; products use 0.00 as a placeholder.
 */
export interface CatalogSeedMeal {
  day: string;
  slug: string;
  title: string;
  ingredients: { name: string; amount: string }[];
  macros: { protein: string; carbs: string; fat: string; calories: string };
}

export const CATALOG_SEED_MEALS: CatalogSeedMeal[] = [
  {
    day: "Monday",
    slug: "monday",
    title: "MacroBox - Healthy Foods",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Dhal curry", amount: "75g" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Eggs", amount: "2" },
      { name: "Broccoli", amount: "75g" },
    ],
    macros: { protein: "54.5g", carbs: "38g", fat: "11g", calories: "469 kcal" },
  },
  {
    day: "Tuesday",
    slug: "tuesday",
    title: "MacroBox - Healthy Foods",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Roasted chickpeas", amount: "75g" },
      { name: "Eggs", amount: "2" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Salad", amount: "75g" },
    ],
    macros: { protein: "58g", carbs: "71.3g", fat: "23.9g", calories: "542.6 kcal" },
  },
  {
    day: "Wednesday",
    slug: "wednesday",
    title: "MacroBox - Healthy Foods",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Gotukola sambol", amount: "75g" },
      { name: "Baked potato", amount: "75g" },
      { name: "Eggs", amount: "2" },
    ],
    macros: { protein: "48g", carbs: "175.2g", fat: "176.4g", calories: "546.4 kcal" },
  },
  {
    day: "Thursday",
    slug: "thursday",
    title: "MacroBox - Healthy Foods",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Chicken breast", amount: "100g" },
      { name: "Eggs", amount: "2" },
      { name: "Dhal curry", amount: "75g" },
      { name: "Boiled vegetables (carrot, beans, potato, cabbage)", amount: "75g" },
    ],
    macros: { protein: "52.3g", carbs: "44.3g", fat: "16.9g", calories: "538.5 kcal" },
  },
  {
    day: "Friday",
    slug: "friday",
    title: "MacroBox - Healthy Foods",
    ingredients: [
      { name: "Basmathi rice", amount: "100g" },
      { name: "Boiled corn", amount: "75g" },
      { name: "Black pepper chicken", amount: "100g" },
      { name: "Eggs", amount: "2" },
      { name: "Chinese cucumber", amount: "75g" },
    ],
    macros: { protein: "49.4g", carbs: "47.3g", fat: "15.4g", calories: "525.4 kcal" },
  },
];
