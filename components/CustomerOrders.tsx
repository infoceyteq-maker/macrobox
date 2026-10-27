"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOutAction } from "@/app/actions/auth";
import { getDashboardDataAction } from "@/app/actions/pos";
import TrackingMap from "@/components/tracking/TrackingMap";
import { notify } from "@/lib/ui/toast";
import type { DashboardData, DashboardOrder } from "@/lib/pos/dashboard-types";
import type { DecimalValue, OrderStatus } from "@/lib/pos/types";

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

const neu =
  "rounded-[1.75rem] bg-[#DCE6DA] shadow-[10px_10px_20px_#b7c4b5,-10px_-10px_20px_#ffffff]";
const inset =
  "rounded-2xl bg-[#DCE6DA] shadow-[inset_7px_7px_14px_#b7c4b5,inset_-7px_-7px_14px_#ffffff]";
const secondary =
  "rounded-2xl bg-[#F7F6F2] px-4 py-3 text-sm font-medium text-[#3d4a42] shadow-[5px_5px_10px_#d3d9d0,-5px_-5px_10px_#ffffff] transition hover:bg-[#edf1e9] disabled:opacity-55";

function asNumber(value: DecimalValue | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: DecimalValue | string | null | undefined): string {
  return asNumber(value).toFixed(2);
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}

function shortId(value: string | null | undefined): string {
  return value ? value.slice(0, 8) : "—";
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function OrderCard({ order, roleLabels }: { order: DashboardOrder; roleLabels: DashboardData["roleLabels"] }) {
  const history = [...(order.order_status_history ?? [])].sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const items = order.order_items ?? [];

  return (
    <article className={`${neu} p-5 sm:p-6`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-mono text-xs text-[#6f7a74]">Order #{shortId(order.id)}</p>
          <h2 className="mt-1 font-display text-xl font-bold">
            {STATUS_LABELS[order.status]} order
          </h2>
          <p className="mt-1 text-xs text-[#6f7a74]">Created {formatDate(order.created_at)}</p>
        </div>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <div className={`${inset} px-4 py-3`}>
          <p className="text-xs uppercase tracking-widest text-[#7b857f]">Food total</p>
          <p className="mt-1 font-display text-lg font-bold">{formatAmount(order.total_food_cost)}</p>
        </div>
        <div className={`${inset} px-4 py-3`}>
          <p className="text-xs uppercase tracking-widest text-[#7b857f]">Transport</p>
          <p className="mt-1 font-display text-lg font-bold">{formatAmount(order.transport_cost)}</p>
        </div>
        <div className={`${inset} px-4 py-3`}>
          <p className="text-xs uppercase tracking-widest text-[#7b857f]">Final total</p>
          <p className="mt-1 font-display text-lg font-bold">{formatAmount(order.final_total)}</p>
        </div>
      </div>

      {order.delivery_address ? (
        <div className={`${inset} mt-3 px-4 py-3 text-sm`}>
          <span className="font-semibold">Deliver to:</span> {order.delivery_address}
        </div>
      ) : null}

      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
            Items
          </h3>
          {items.length === 0 ? (
            <p className="mt-3 text-sm text-[#6f7a74]">No line items.</p>
          ) : (
            <div className="mt-3 space-y-2">
              {items.map((item) => (
                <div key={item.id} className={`${inset} flex items-center justify-between gap-3 px-4 py-3`}>
                  <div>
                    <p className="text-sm font-semibold">{item.title_snapshot}</p>
                    <p className="text-xs text-[#6f7a74]">Qty {item.quantity}</p>
                  </div>
                  <p className="text-sm font-semibold">{formatAmount(item.line_total)}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        <div>
          <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
            Tracking timeline
          </h3>
          {history.length === 0 ? (
            <p className="mt-3 text-sm text-[#6f7a74]">Waiting for the first update.</p>
          ) : (
            <ol className="mt-3 space-y-2">
              {history.map((entry) => (
                <li key={entry.id} className={`${inset} px-4 py-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {entry.from_status ? STATUS_LABELS[entry.from_status] : "Created"} →{" "}
                      {STATUS_LABELS[entry.to_status]}
                    </p>
                    {entry.is_admin_override ? (
                      <span className="rounded-full bg-[#f4e7c9] px-2 py-1 text-[10px] font-bold text-[#7a5b1d]">
                        Admin override
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#6f7a74]">
                    {roleLabels[entry.actor_role]} · {formatDate(entry.created_at)}
                  </p>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {order.status === "CLOSED" && order.cash_settlement_reference ? (
        <p className="mt-4 text-xs text-[#6f7a74]">
          Settlement reference:{" "}
          <span className="font-mono">{order.cash_settlement_reference}</span>
        </p>
      ) : null}
    </article>
  );
}

export default function CustomerOrders({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(initialData);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isStaff = data.actor.role !== "CUSTOMER";
  const canDriver = data.actor.role === "DRIVER" || data.actor.role === "ADMIN";
  const activeOrder =
    data.orders.find(
      (order) => order.status !== "DELIVERED" && order.status !== "CLOSED",
    ) ?? data.orders[0];

  async function refresh() {
    setBusy(true);
    setMessage(null);
    const result = await getDashboardDataAction();
    if (result.ok) {
      setData(result.data);
      setMessage("Orders refreshed.");
      notify.success("Tracking updated", "Latest order statuses loaded.");
    } else {
      const failure = `[${result.code}] ${result.error}`;
      setMessage(failure);
      notify.error("Refresh failed", failure);
    }
    setBusy(false);
    router.refresh();
  }

  async function signOut() {
    setBusy(true);
    const result = await signOutAction();
    setBusy(false);
    if (!result.ok) {
      const failure = `[${result.code}] ${result.error}`;
      setMessage(failure);
      notify.error("Sign-out failed", failure);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  return (
    <main className="min-h-screen bg-[#DCE6DA] px-4 py-6 text-[#2E3033] sm:px-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <header className={`${neu} flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6`}>
          <div className="flex items-center gap-4">
            <Image
              src="/macrobox_primary_cutout.png"
              alt="MacroBox"
              width={170}
              height={64}
              priority
              className="h-auto w-[150px] object-contain sm:w-[170px]"
            />
            <div>
              <p className="font-display text-lg font-bold">My orders</p>
              <p className="text-xs text-[#6f7a74]">
                {data.actor.name} · {data.roleLabels[data.actor.role]}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/" className={secondary}>
              Catalog
            </Link>
            {isStaff ? (
              <Link href="/pos" className={secondary}>
                POS dashboard
              </Link>
            ) : null}
            {canDriver ? (
              <Link href="/driver" className={secondary}>
                Driver view
              </Link>
            ) : null}
            <button type="button" onClick={refresh} disabled={busy} className={secondary}>
              Refresh
            </button>
            <button type="button" onClick={signOut} disabled={busy} className={secondary}>
              Sign out
            </button>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl bg-[#dcead7] px-5 py-4 text-sm font-medium text-[#3f6b45]">
            {message}
          </div>
        ) : null}

        {activeOrder ? <TrackingMap order={activeOrder} /> : null}

        {data.orders.length === 0 ? (
          <section className={`${neu} p-8 text-center`}>
            <h1 className="font-display text-2xl font-bold">No orders yet</h1>
            <p className="mt-2 text-sm text-[#6f7a74]">
              Your orders will appear here with live status updates.
            </p>
            <Link href="/" className={`${secondary} mt-5 inline-block`}>
              Browse the catalog
            </Link>
          </section>
        ) : (
          <div className="space-y-5">
            {data.orders.map((order) => (
              <OrderCard key={order.id} order={order} roleLabels={data.roleLabels} />
            ))}
          </div>
        )}

        <footer className="pb-4 text-center text-xs text-[#7b857f]">
          MacroBox order tracking · Live {data.schema} · {formatDate(data.generatedAt)}
        </footer>
      </div>
    </main>
  );
}
