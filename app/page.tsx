import PromotionalBanner from "@/components/home/PromotionalBanner";
import { LunchCatalog } from "@/components/LunchCatalog";
import CustomerNavbar from "@/components/layout/CustomerNavbar";

export default function Home() {
  return (
    <>
      <PromotionalBanner />
      <CustomerNavbar />
      <LunchCatalog />
    </>
  );
}
