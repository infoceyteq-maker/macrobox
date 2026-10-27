import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import PortalShell from "@/components/layout/PortalShell";
import OrderDocuments from "@/components/billing/OrderDocuments";
import { cn, NEU } from "@/components/ui/neu";
import { loadDashboardData } from "@/lib/pos/dashboard";
import { PosActionError } from "@/lib/pos/errors";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "MacroBox | Digital E-Bill",
  description: "MacroBox cash-on-delivery digital invoice and 80mm thermal print layout.",
};

export default async function BillPage({
  params,
}: {
  params: Promise<{ orderId: string }>;
}) {
  const { orderId } = await params;
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
      redirect(`/login?next=${encodeURIComponent(`/bill/${orderId}`)}`);
    }
    throw error;
  }

  const order = data.orders.find((item) => item.id === orderId);
  if (!order) redirect("/orders");

  return (
    <PortalShell
      title="Digital e-bill"
      subtitle={`Order #${order.id.slice(0, 8)} · Cash on Delivery`}
      actions={
        <Link href="/orders" className={cn(NEU.button, "text-center")}>
          Back to orders
        </Link>
      }
    >
      <OrderDocuments
        orders={[order]}
        settings={data.settings}
        roleLabels={data.roleLabels}
        schema={data.schema}
        compact
        initialOrderId={order.id}
      />
    </PortalShell>
  );
}
