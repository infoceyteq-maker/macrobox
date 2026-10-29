import { CUSTOMER_CONTACT } from "@/lib/brand";

const PROMOTIONS = [
  "Weekday Lunch (Rice & Curry)",
  "Monday–Friday menu",
  "Cash on Delivery available",
  `Call or WhatsApp ${CUSTOMER_CONTACT.phoneDisplay}`,
  CUSTOMER_CONTACT.email,
] as const;

export default function PromotionalBanner() {
  return (
    <div
      className="overflow-hidden bg-[#2E3033] text-[#F7F6F2]"
      aria-label="MacroBox current information"
    >
      <div className="macrobox-marquee-track flex w-max whitespace-nowrap py-2 text-[11px] font-semibold uppercase tracking-[0.18em]">
        {[0, 1].map((copy) => (
          <div key={copy} aria-hidden={copy === 1} className="flex shrink-0 items-center">
            {PROMOTIONS.map((item) => (
              <span key={`${copy}-${item}`} className="flex items-center">
                <span className="px-5">{item}</span>
                <span aria-hidden="true" className="text-[#8FBC8F]">
                  •
                </span>
              </span>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
