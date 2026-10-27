"use client";

import { ORDER_STATUSES, type OrderStatus } from "@/lib/pos/types";
import { cn, formatAmount, formatDate, NEU } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import type { DashboardOrder } from "@/lib/pos/dashboard-types";
import type { DeliverySettingsRow } from "@/lib/pos/types";

interface FinancialsPanelProps {
  orders: DashboardOrder[];
  settings: DeliverySettingsRow;
  schema: string;
}

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
};

function asNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function FinancialsPanel({ orders, settings, schema }: FinancialsPanelProps) {
  const food = orders.reduce((sum, order) => sum + asNumber(order.total_food_cost), 0);
  const transport = orders.reduce((sum, order) => sum + asNumber(order.transport_cost), 0);
  const finalTotal = orders.reduce((sum, order) => sum + asNumber(order.final_total), 0);
  const collected = orders.reduce(
    (sum, order) => sum + asNumber(order.cash_collected_amount),
    0,
  );
  const settled = orders
    .filter((order) => order.status === "CLOSED")
    .reduce((sum, order) => sum + asNumber(order.final_total), 0);
  const unsettled = orders
    .filter((order) => order.status === "DELIVERED")
    .reduce((sum, order) => sum + asNumber(order.final_total), 0);
  const pricePending = orders.filter((order) => asNumber(order.total_food_cost) === 0).length;
  const counts = ORDER_STATUSES.map((status) => ({
    status,
    count: orders.filter((order) => order.status === status).length,
  }));
  const maxCount = Math.max(...counts.map((item) => item.count), 1);

  function exportCsv() {
    const header = [
      "order_id",
      "status",
      "food_total",
      "transport_cost",
      "final_total",
      "cash_collected",
      "settlement_reference",
      "created_at",
    ];
    const rows = orders.map((order) =>
      [
        order.id,
        order.status,
        formatAmount(order.total_food_cost),
        formatAmount(order.transport_cost),
        formatAmount(order.final_total),
        order.cash_collected_amount === null ? "" : formatAmount(order.cash_collected_amount),
        order.cash_settlement_reference || "",
        order.created_at,
      ]
        .map((value) => `"${String(value).replace(/"/g, '""')}"`)
        .join(","),
    );
    const csv = [header.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `macrobox-financials-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
    notify.success("Financials exported", `${orders.length} recorded orders written to CSV.`);
  }

  return (
    <div className="space-y-5">
      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">
              Financials · provisional P&amp;L
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">Recorded order value</h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-[#6f7a74]">
              Derived only from live order rows. Cost of goods, salaries, overheads, refunds, and
              taxes are not in the supplied schema, so no profit figure is invented.
            </p>
          </div>
          <button type="button" onClick={exportCsv} className={cn(NEU.button, "no-print")}>
            Export CSV
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Food subtotal" value={formatAmount(food)} hint="0.00 = price pending" />
          <Stat label="Transport" value={formatAmount(transport)} hint="Dynamic distance billing" />
          <Stat label="Final e-bill value" value={formatAmount(finalTotal)} hint="Before costs" />
          <Stat label="Cash collected" value={formatAmount(collected)} hint="Delivery evidence" />
          <Stat label="Settled" value={formatAmount(settled)} hint="CLOSED orders" />
          <Stat label="Awaiting settlement" value={formatAmount(unsettled)} hint="DELIVERED orders" />
          <Stat label="Price-pending orders" value={String(pricePending)} hint="Needs approved price" />
          <Stat
            label="Transport model"
            value={
              settings.is_configured && settings.rate_model === "TIERED_LKR"
                ? `${settings.currency_code} tiered`
                : "Not configured"
            }
            hint="0–3 km LKR 150 · 4th +120 · 5th +100 · >5 +60/km"
          />
        </div>
      </section>

      <div className="grid gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <section className={cn(NEU.card, "p-5 sm:p-6")}>
          <h3 className="font-display text-lg font-bold">Order pipeline</h3>
          <div className="mt-4 space-y-3">
            {counts.map(({ status, count }) => (
              <div key={status}>
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-[#6f7a74]">{STATUS_LABELS[status]}</span>
                  <span className="font-bold">{count}</span>
                </div>
                <div className={cn(NEU.track, "mt-1.5")}>
                  <div
                    className={NEU.fill}
                    style={{ width: `${Math.max(4, (count / maxCount) * 100)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className={cn(NEU.card, "p-5 sm:p-6")}>
          <h3 className="font-display text-lg font-bold">Recent ledger</h3>
          <div className="mt-4 max-h-[320px] space-y-2 overflow-y-auto pr-1">
            {orders.length === 0 ? (
              <p className="text-sm text-[#6f7a74]">No orders recorded yet.</p>
            ) : (
              orders.slice(0, 10).map((order) => (
                <div key={order.id} className={cn(NEU.insetTiny, "flex items-center justify-between gap-3 px-3 py-2")}>
                  <div>
                    <p className="font-mono text-xs text-[#6f7a74]">#{order.id.slice(0, 8)}</p>
                    <p className="text-xs text-[#6f7a74]">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold">{formatAmount(order.final_total)}</p>
                    <p className="text-[10px] uppercase tracking-widest text-[#7b857f]">
                      {STATUS_LABELS[order.status]}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
          <p className="mt-4 text-xs text-[#6f7a74]">Live schema: {schema}</p>
        </section>
      </div>
    </div>
  );
}

function Stat({ label, value, hint }: { label: string; value: string; hint: string }) {
  return (
    <div className={cn(NEU.inset, "px-4 py-3")}>
      <p className="text-[10px] font-semibold uppercase tracking-widest text-[#7b857f]">{label}</p>
      <p className="mt-2 font-display text-xl font-bold">{value}</p>
      <p className="mt-1 text-xs text-[#6f7a74]">{hint}</p>
    </div>
  );
}
