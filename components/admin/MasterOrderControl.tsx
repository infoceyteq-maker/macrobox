"use client";

import { useState } from "react";
import { assignDriverAction, transitionOrderStatusAction } from "@/app/actions/pos";
import { cn, formatAmount, NEU, shortId } from "@/components/ui/neu";
import type { DashboardOrder, DirectoryUser } from "@/lib/pos/dashboard-types";
import type { ActionResult, OrderStatus } from "@/lib/pos/types";

type RunAction = (
  label: string,
  fn: () => Promise<ActionResult<unknown>>,
  successMessage?: string,
) => Promise<unknown>;

interface MasterOrderControlProps {
  orders: DashboardOrder[];
  drivers: DirectoryUser[];
  busy: boolean;
  run: RunAction;
  onOpen: (orderId: string) => void;
}

const LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
};

export default function MasterOrderControl({
  orders,
  drivers,
  busy,
  run,
  onOpen,
}: MasterOrderControlProps) {
  const [driverByOrder, setDriverByOrder] = useState<Record<string, string>>({});
  const incoming = orders.filter(
    (order) => !["DELIVERED", "CLOSED"].includes(order.status),
  );

  function expectedFor(order: DashboardOrder) {
    return { expectedStatus: order.status, expectedVersion: Number(order.version) };
  }

  function move(order: DashboardOrder, toStatus: OrderStatus) {
    return run(
      `Move to ${LABELS[toStatus]}`,
      () =>
        transitionOrderStatusAction({
          orderId: order.id,
          toStatus,
          ...expectedFor(order),
          metadata: { note: `Master Admin set ${toStatus}` },
        }),
      `Order #${shortId(order.id)} moved to ${LABELS[toStatus]}.`,
    );
  }

  function dispatch(order: DashboardOrder) {
    const driverId = driverByOrder[order.id] || drivers[0]?.id;
    if (!driverId) return;
    return run(
      "Assign & dispatch",
      () =>
        assignDriverAction({
          orderId: order.id,
          driverId,
          dispatch: true,
          ...expectedFor(order),
        }),
      `Order #${shortId(order.id)} dispatched to a driver.`,
    );
  }

  return (
    <section className={cn(NEU.card, "p-5 sm:p-6")}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">
            Omnipotent master control
          </p>
          <h2 className="mt-1 font-display text-xl font-bold">Incoming orders</h2>
          <p className="mt-1 text-xs text-[#6f7a74]">
            Admin can bypass kitchen steps, mark Ready alone, and assign a driver instantly.
          </p>
        </div>
        <span className={cn(NEU.badge, "!text-[10px] uppercase tracking-widest")}>
          {incoming.length} active
        </span>
      </div>

      <div className="mt-5 space-y-3">
        {incoming.length === 0 ? (
          <div className={cn(NEU.inset, "px-5 py-8 text-center text-sm text-[#6f7a74]")}>
            No incoming orders right now.
          </div>
        ) : (
          incoming.slice(0, 8).map((order) => (
            <article key={order.id} className={cn(NEU.inset, "space-y-3 p-4")}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <p className="font-mono text-xs text-[#6f7a74]">#{shortId(order.id)}</p>
                  <p className="mt-1 font-display text-base font-bold">
                    {order.customer?.name ?? "Customer"} · {formatAmount(order.final_total)}
                  </p>
                  <p className="mt-1 text-xs text-[#6f7a74]">
                    {LABELS[order.status]} · {order.delivery_address || "Address pending"}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => onOpen(order.id)}
                  className={cn(NEU.button, "!px-3 !py-2 text-xs")}
                >
                  Open
                </button>
              </div>

              <div className="flex flex-wrap gap-2">
                {order.status !== "ACCEPTED" &&
                order.status !== "PREPARING" &&
                order.status !== "READY" &&
                order.status !== "DISPATCHED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => move(order, "ACCEPTED")}
                    className={cn(NEU.button, "!px-3 !py-2 text-xs")}
                  >
                    Accept
                  </button>
                ) : null}
                {order.status !== "PREPARING" &&
                order.status !== "READY" &&
                order.status !== "DISPATCHED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => move(order, "PREPARING")}
                    className={cn(NEU.button, "!px-3 !py-2 text-xs")}
                  >
                    Mark Preparing
                  </button>
                ) : null}
                {order.status !== "READY" && order.status !== "DISPATCHED" ? (
                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => move(order, "READY")}
                    className={cn(NEU.buttonPrimary, "!px-3 !py-2 text-xs")}
                  >
                    Mark Ready
                  </button>
                ) : null}
                {order.status === "READY" && drivers.length > 0 ? (
                  <>
                    <select
                      value={driverByOrder[order.id] || drivers[0]?.id || ""}
                      onChange={(event) =>
                        setDriverByOrder((current) => ({
                          ...current,
                          [order.id]: event.target.value,
                        }))
                      }
                      className={cn(NEU.input, "!w-auto !py-2 text-xs")}
                      aria-label="Assign driver"
                    >
                      {drivers.map((driver) => (
                        <option key={driver.id} value={driver.id}>
                          {driver.name || driver.email || shortId(driver.id)}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => dispatch(order)}
                      className={cn(NEU.buttonPrimary, "!px-3 !py-2 text-xs")}
                    >
                      Assign &amp; dispatch
                    </button>
                  </>
                ) : null}
                {order.status === "DISPATCHED" ? (
                  <span className={cn(NEU.badge, "!text-[10px]")}>Driver en route</span>
                ) : null}
              </div>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
