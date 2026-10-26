import { LunchCatalog } from "@/components/LunchCatalog";

export default function Home() {
  // Uploaded curry/dish data can be supplied through the `mealUpdates` prop
  // or published at runtime with the `macrobox:meal-updates` event.
  return <LunchCatalog />;
}
