import type { Metadata } from "next";
import { redirect } from "next/navigation";
import PosDashboard from "@/components/PosDashboard";
import { loadDashboardData } from "@/lib/pos/dashboard";
import { PosActionError } from "@/lib/pos/errors";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MacroBox | Omnipotent Master Admin",
  description: "Unified MacroBox order, employee, financial, menu, e-bill, and driver control.",
};

export default async function AdminPage() {
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
      redirect("/admin/login?next=/admin");
    }
    throw error;
  }

  if (data.actor.role !== "ADMIN") redirect("/pos");
  return <PosDashboard initialData={data} masterMode />;
}
