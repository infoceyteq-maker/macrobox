import { redirect } from "next/navigation";
import PosDashboard from "@/components/PosDashboard";
import { loadDashboardData } from "@/lib/pos/dashboard";

export const dynamic = "force-dynamic";

export default async function PosPage() {
  let data;
  try {
    data = await loadDashboardData();
  } catch {
    redirect("/frontdesk/login?next=/pos");
  }

  return <PosDashboard initialData={data} />;
}
