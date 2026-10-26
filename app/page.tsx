import Link from "next/link";
import { LunchCatalog } from "@/components/LunchCatalog";

export default function Home() {
  // Uploaded curry/dish data can be supplied through the `mealUpdates` prop
  // or published at runtime with the `macrobox:meal-updates` event.
  return (
    <>
      <LunchCatalog />
      <Link
        href="/pos"
        className="fixed bottom-5 right-5 z-50 rounded-2xl bg-[#8FBC8F] px-5 py-3 font-display text-sm font-bold text-[#223028] shadow-[8px_8px_16px_#b7c4b5,-8px_-8px_16px_#ffffff] transition hover:bg-[#7CA982]"
      >
        Staff / POS →
      </Link>
    </>
  );
}
