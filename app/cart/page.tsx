import type { Metadata } from "next";
import PortalShell from "@/components/layout/PortalShell";
import CartCheckout from "@/components/cart/CartCheckout";

export const metadata: Metadata = {
  title: "MacroBox | Cart & COD Checkout",
  description: "Review your MacroBox weekday meals and place a cash-on-delivery order.",
};

export default function CartPage() {
  return (
    <PortalShell
      title="Cart & checkout"
      subtitle="Soft UI basket · Cash on Delivery · Transport calculated at delivery"
    >
      <CartCheckout />
    </PortalShell>
  );
}
