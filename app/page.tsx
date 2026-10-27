import Link from "next/link";
import { LunchCatalog } from "@/components/LunchCatalog";

const linkClass =
  "rounded-2xl bg-[#F7F6F2] px-4 py-2 font-display text-xs font-bold text-[#3d4a42] shadow-[6px_6px_12px_#c9d2c5,-6px_-6px_12px_#ffffff] transition hover:bg-[#edf1e9]";

const primaryLinkClass =
  "rounded-2xl bg-[#8FBC8F] px-5 py-3 font-display text-sm font-bold text-[#223028] shadow-[8px_8px_16px_#b7c4b5,-8px_-8px_16px_#ffffff] transition hover:bg-[#7CA982]";

export default function Home() {
  return (
    <>
      <LunchCatalog />
      <div className="fixed bottom-5 right-5 z-50 flex flex-col items-end gap-2">
        <Link href="/customer/login" className={primaryLinkClass}>
          Sign in / Register →
        </Link>
        <Link href="/profile" className={linkClass}>
          My Profile →
        </Link>
        <Link href="/orders" className={linkClass}>
          Track my orders →
        </Link>
        <Link href="/cart" className={linkClass}>
          Cart →
        </Link>
      </div>
    </>
  );
}
