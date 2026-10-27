import Link from "next/link";
import { LunchCatalog } from "@/components/LunchCatalog";

export default function Home() {
  // Uploaded curry/dish data can be supplied through the `mealUpdates` prop
  // or published at runtime with the `macrobox:meal-updates` event.
  return (
    <>
      <LunchCatalog />
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        <Link
          href="/orders"
          className="rounded-2xl bg-[#F7F6F2] px-4 py-2 font-display text-xs font-bold text-[#3d4a42] shadow-[6px_6px_12px_#c9d2c5,-6px_-6px_12px_#ffffff] transition hover:bg-[#edf1e9]"
        >
          Track my orders →
        </Link>
        <Link
          href="/admin"
          className="rounded-2xl bg-[#F7F6F2] px-4 py-2 font-display text-xs font-bold text-[#3d4a42] shadow-[6px_6px_12px_#c9d2c5,-6px_-6px_12px_#ffffff] transition hover:bg-[#edf1e9]"
        >
          Master Admin →
        </Link>
        <Link
          href="/pos"
          className="rounded-2xl bg-[#8FBC8F] px-5 py-3 font-display text-sm font-bold text-[#223028] shadow-[8px_8px_16px_#b7c4b5,-8px_-8px_16px_#ffffff] transition hover:bg-[#7CA982]"
        >
          Staff / POS →
        </Link>
      </div>
    </>
  );
}
