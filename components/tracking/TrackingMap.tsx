"use client";

import Link from "next/link";
import RouteMap from "@/components/tracking/RouteMap";
import { cn, formatAmount, NEU } from "@/components/ui/neu";
import type { DashboardOrder } from "@/lib/pos/dashboard-types";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/pos/types";

const STATUS_PROGRESS: Record<OrderStatus, number> = {
  PENDING: 0.04,
  ACCEPTED: 0.16,
  PREPARING: 0.32,
  READY: 0.46,
  DISPATCHED: 0.74,
  DELIVERED: 1,
  CLOSED: 1,
};

const STATUS_ETA: Record<OrderStatus, string> = {
  PENDING: "35–45 min",
  ACCEPTED: "30–40 min",
  PREPARING: "25–35 min",
  READY: "18–28 min",
  DISPATCHED: "10–18 min",
  DELIVERED: "Delivered",
  CLOSED: "Completed",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Order Received",
  ACCEPTED: "Order Accepted",
  PREPARING: "Kitchen Preparing",
  READY: "Meal Ready",
  DISPATCHED: "Driver on the way",
  DELIVERED: "Delivered & Cash Collected",
  CLOSED: "Payment Settled",
};

const STATUS_MESSAGES: Record<OrderStatus, string> = {
  PENDING: "We have your order and are waiting for the kitchen to accept it.",
  ACCEPTED: "Order Accepted — your meal is queued for preparation.",
  PREPARING: "Kitchen is preparing your meal with the supplied grammages.",
  READY: "Meal Ready — waiting for driver assignment and dispatch.",
  DISPATCHED: "Driver on the way — your order has left the kitchen.",
  DELIVERED: "Delivered & Cash Collected — signature captured.",
  CLOSED: "Payment Settled — thank you for choosing MacroBox.",
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

interface TrackingMapProps {
  order: DashboardOrder;
}

export default function TrackingMap({ order }: TrackingMapProps) {
  const currentIndex = ORDER_STATUSES.indexOf(order.status);
  const progress = STATUS_PROGRESS[order.status];
  const eta = STATUS_ETA[order.status];
  const isFinal = order.status === "DELIVERED" || order.status === "CLOSED";

  return (
    <section className="space-y-5">
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <RouteMap
          progress={progress}
          label={`Order #${order.id.slice(0, 8)}`}
          sublabel={`${STATUS_LABELS[order.status]} · ${STATUS_MESSAGES[order.status]}`}
          badge="Simulated live location"
          footer="This is a UI simulation of driver movement. Connect Google Maps / real GPS only after a key and tracking policy are supplied."
        />

        <div className={cn(NEU.card, "p-5")}>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">Estimated time</p>
          <p className="mt-2 font-display text-3xl font-bold">{eta}</p>
          <p className="mt-2 text-sm text-[#6f7a74]">
            {isFinal ? "Your order journey is complete." : "Updated as the order moves through the kitchen."}
          </p>

          <div className="mt-5 space-y-2 text-sm">
            <div className="flex justify-between gap-3">
              <span className="text-[#6f7a74]">Food total</span>
              <span className="font-semibold">{formatAmount(order.total_food_cost)}</span>
            </div>
            <div className="flex justify-between gap-3">
              <span className="text-[#6f7a74]">Transport</span>
              <span className="font-semibold">{formatAmount(order.transport_cost)}</span>
            </div>
            <div className={cn(NEU.inset, "flex justify-between gap-3 px-4 py-3")}>
              <span className="font-semibold">Final e-bill</span>
              <span className="font-display text-lg font-bold">{formatAmount(order.final_total)}</span>
            </div>
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            <Link href={`/bill/${order.id}`} className={cn(NEU.buttonPrimary, "flex-1 text-center")}>
              Open e-bill
            </Link>
            <Link href="/" className={cn(NEU.button, "flex-1 text-center")}>
              Menu
            </Link>
          </div>
        </div>
      </div>

      <div className={cn(NEU.card, "p-5")}>
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
          Return messages
        </h3>
        <div className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
          {ORDER_STATUSES.map((status, index) => {
            const reached = index <= currentIndex;
            return (
              <div
                key={status}
                className={cn(
                  NEU.insetTiny,
                  "px-3 py-3",
                  reached ? "opacity-100" : "opacity-45",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold">{STATUS_LABELS[status]}</span>
                  <span
                    className={cn(
                      "h-2.5 w-2.5 rounded-full",
                      reached ? STATUS_STYLES[status] : "bg-[#cbd3c8]",
                    )}
                  />
                </div>
                <p className="mt-1 text-[11px] leading-4 text-[#6f7a74]">{STATUS_MESSAGES[status]}</p>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
