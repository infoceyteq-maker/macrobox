import { redirect } from "next/navigation";
import { PosActionError } from "@/lib/pos/errors";
import { loadDashboardData } from "@/lib/pos/dashboard";
import CustomerOrders from "@/components/CustomerOrders";

export const dynamic = "force-dynamic";

export default async function OrdersPage() {
  let data;
  try {
    data = await loadDashboardData();
  } catch (error) {
    if (
      error instanceof PosActionError &&
      ["UNAUTHENTICATED", "USER_NOT_PROVISIONED", "USER_INACTIVE", "FORBIDDEN"].includes(
        error.code,
      )
    ) {
      redirect("/login?next=/orders");
    }
    throw error;
  }
  return <CustomerOrders initialData={data} />;
}
