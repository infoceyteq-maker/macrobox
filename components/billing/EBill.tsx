"use client";

import Image from "next/image";
import Link from "next/link";
import { CONTACT_LINE } from "@/lib/brand";
import { notify } from "@/lib/ui/toast";
import { cn, formatAmount, formatDate, NEU, shortId } from "@/components/ui/neu";
import type { DashboardOrder } from "@/lib/pos/dashboard-types";
import type {
  AppRole,
  DecimalValue,
  DeliverySettingsRow,
  OrderStatus,
} from "@/lib/pos/types";

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
};

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-[#f4e7c9] text-[#7a5b1d]",
  ACCEPTED: "bg-[#e2eccd] text-[#4d6b30]",
  PREPARING: "bg-[#f7dfc8] text-[#8a542b]",
  READY: "bg-[#d8ead9] text-[#3f6b45]",
  DISPATCHED: "bg-[#d7e5ef] text-[#345d75]",
  DELIVERED: "bg-[#dce9d6] text-[#4a6c3c]",
  CLOSED: "bg-[#e5e3de] text-[#5b5e5a]",
};

interface EBillProps {
  order: DashboardOrder;
  settings?: DeliverySettingsRow;
  roleLabels?: Record<AppRole, string>;
  foodTotal?: DecimalValue;
  transportCost?: DecimalValue;
  finalTotal?: DecimalValue;
  distanceKm?: number | null;
  schema?: string;
  compact?: boolean;
  showActions?: boolean;
  heading?: string;
}

export default function EBill({
  order,
  settings,
  foodTotal,
  transportCost,
  finalTotal,
  distanceKm,
  schema,
  compact = false,
  showActions = true,
  heading = "Digital e-bill",
}: EBillProps) {
  const items = order.order_items ?? [];
  const food = formatAmount(foodTotal ?? order.total_food_cost);
  const transport = formatAmount(transportCost ?? order.transport_cost);
  const total = formatAmount(finalTotal ?? order.final_total);
  const rate = settings?.per_km_rate ?? null;
  const freeDistance = settings?.free_distance_km ?? 2;
  const billUrl = `/bill/${order.id}`;

  async function shareBill() {
    if (typeof window === "undefined") return;
    const url = `${window.location.origin}${billUrl}`;
    const shareData = {
      title: `MacroBox e-bill #${shortId(order.id)}`,
      text: `MacroBox e-bill ${shortId(order.id)} — final total ${total}. Cash on Delivery.`,
      url,
    };
    try {
      if (navigator.share) {
        await navigator.share(shareData);
        notify.success("E-bill shared", "The customer can open the digital invoice.");
        return;
      }
      if (navigator.clipboard) {
        await navigator.clipboard.writeText(url);
        notify.success("E-bill link copied", url);
        return;
      }
      notify.warning("Sharing unavailable", "Open the e-bill and copy its URL manually.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      notify.error("Could not share", error instanceof Error ? error.message : "Unexpected error.");
    }
  }

  return (
    <article className={cn(NEU.card, compact ? "p-4" : "p-5 sm:p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <Image
            src="/macrobox_primary_cutout.png"
            alt="MacroBox"
            width={150}
            height={56}
            className="h-auto w-[130px] object-contain"
          />
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">{heading}</p>
            <h2 className="mt-1 font-display text-xl font-bold">#{shortId(order.id)}</h2>
          </div>
        </div>
        <span
          className={cn(
            "inline-flex rounded-full px-3 py-1 text-xs font-bold",
            STATUS_STYLES[order.status],
          )}
        >
          {STATUS_LABELS[order.status]}
        </span>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-2">
        <div className={cn(NEU.inset, "px-4 py-3 text-sm")}>
          <p className="text-xs uppercase tracking-widest text-[#7b857f]">Customer</p>
          <p className="mt-1 font-semibold">{order.customer?.name ?? shortId(order.customer_id)}</p>
          <p className="mt-1 text-xs text-[#6f7a74]">{order.delivery_address || "Address pending"}</p>
        </div>
        <div className={cn(NEU.inset, "px-4 py-3 text-sm")}>
          <p className="text-xs uppercase tracking-widest text-[#7b857f]">Driver</p>
          <p className="mt-1 font-semibold">{order.driver?.name ?? "Not assigned"}</p>
          <p className="mt-1 text-xs text-[#6f7a74]">Created {formatDate(order.created_at)}</p>
        </div>
      </div>

      <div className="mt-5 overflow-hidden">
        <table className="w-full text-left text-sm">
          <thead>
            <tr className="text-xs uppercase tracking-widest text-[#7b857f]">
              <th className="pb-2">Item</th>
              <th className="pb-2 text-center">Qty</th>
              <th className="pb-2 text-right">Line total</th>
            </tr>
          </thead>
          <tbody>
            {items.length === 0 ? (
              <tr>
                <td colSpan={3} className="py-4 text-center text-[#6f7a74]">
                  No line items available.
                </td>
              </tr>
            ) : (
              items.map((item) => (
                <tr key={item.id} className="border-t border-white/70">
                  <td className="py-3 pr-3 font-medium">{item.title_snapshot}</td>
                  <td className="py-3 text-center">{item.quantity}</td>
                  <td className="py-3 text-right font-semibold">{formatAmount(item.line_total)}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <div className="mt-4 space-y-2 text-sm">
        <div className="flex justify-between gap-3">
          <span className="text-[#6f7a74]">Food subtotal</span>
          <span className="font-semibold">{food}</span>
        </div>
        <div className="flex justify-between gap-3">
          <span className="text-[#6f7a74]">Dynamic transport</span>
          <span className="font-semibold">{transport}</span>
        </div>
        {distanceKm !== null && distanceKm !== undefined ? (
          <div className="flex justify-between gap-3 text-xs text-[#6f7a74]">
            <span>Distance</span>
            <span>{formatAmount(distanceKm)} km</span>
          </div>
        ) : null}
        {rate !== null ? (
          <div className="flex justify-between gap-3 text-xs text-[#6f7a74]">
            <span>Formula</span>
            <span>max(km − {formatAmount(freeDistance)}, 0) × {formatAmount(rate)}</span>
          </div>
        ) : (
          <p className="text-xs text-[#8a542b]">Transport rate is not configured by Admin yet.</p>
        )}
        <div className={cn(NEU.inset, "mt-3 flex items-center justify-between gap-3 px-4 py-3")}>
          <span className="font-display text-sm font-bold uppercase tracking-widest">Final e-bill</span>
          <span className="font-display text-2xl font-bold">{total}</span>
        </div>
      </div>

      <div className="mt-4 grid gap-2 text-xs text-[#6f7a74] sm:grid-cols-2">
        <p>Payment: <span className="font-semibold text-[#2E3033]">Cash on Delivery</span></p>
        <p>
          Cash collected:{" "}
          <span className="font-semibold text-[#2E3033]">
            {order.cash_collected_amount === null
              ? "Pending"
              : formatAmount(order.cash_collected_amount)}
          </span>
        </p>
        <p>
          Settlement:{" "}
          <span className="font-semibold text-[#2E3033]">
            {order.cash_settlement_reference || "Pending"}
          </span>
        </p>
        <p>
          Signature:{" "}
          <span className="font-semibold text-[#2E3033]">
            {order.delivery_signature_url ? "Captured" : "Pending"}
          </span>
        </p>
      </div>

      <p className="mt-5 text-center text-[11px] leading-5 text-[#7b857f]">{CONTACT_LINE}</p>
      {schema ? <p className="mt-1 text-center text-[10px] text-[#9aa49d]">Live {schema}</p> : null}

      {showActions ? (
        <div className="mt-5 flex flex-wrap gap-2 no-print">
          <button type="button" onClick={shareBill} className={cn(NEU.buttonPrimary, "flex-1")}>
            Send to customer
          </button>
          <Link href={billUrl} className={cn(NEU.button, "flex-1 text-center")}>
            Open e-bill
          </Link>
        </div>
      ) : null}
    </article>
  );
}
