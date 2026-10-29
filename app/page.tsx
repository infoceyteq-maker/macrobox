import { LunchCatalog } from "@/components/LunchCatalog";
import CustomerNavbar from "@/components/layout/CustomerNavbar";

export default function Home() {
  return (
    <>
      <CustomerNavbar />
      <LunchCatalog />
    </>
  );
}
