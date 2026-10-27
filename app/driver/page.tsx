import { redirect } from "next/navigation";
import { PosActionError } from "@/lib/pos/errors";
import { loadDashboardData } from "@/lib/pos/dashboard";
import DriverPortal from "@/components/DriverPortal";

export const dynamic = "force-dynamic";

export default async function DriverPage() {
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
      redirect("/driver/login?next=/driver");
    }
    throw error;
  }
  if (data.actor.role !== "DRIVER" && data.actor.role !== "ADMIN") {
    redirect("/orders");
  }
  return <DriverPortal initialData={data} />;
}
