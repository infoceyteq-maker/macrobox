"use client";

import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/SignaturePad";
import DeliveryMapPlaceholder from "@/components/tracking/DeliveryMapPlaceholder";
import EBill from "@/components/billing/EBill";
import { notify } from "@/lib/ui/toast";
import { signOutAction } from "@/app/actions/auth";
import { getDashboardDataAction, recordDeliveryAction } from "@/app/actions/pos";
import type { DashboardData, DashboardOrder } from "@/lib/pos/dashboard-types";
import {
  calculateTransportCost,
  getTransportTierConfig,
  isTransportConfigured,
  TRANSPORT_TIER_LABELS,
} from "@/lib/pos/transport";
import type { DecimalValue, DeliverySettingsRow, OrderStatus } from "@/lib/pos/types";

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
const inputClass =
  "w-full rounded-2xl bg-[#DCE6DA] px-4 py-3 text-sm shadow-[inset_7px_7px_14px_#b7c4b5,inset_-7px_-7px_14px_#ffffff] outline-none placeholder:text-[#9aa49d] focus:ring-2 focus:ring-[#8FBC8F] disabled:opacity-60";
const primary =
  "rounded-2xl bg-[#8FBC8F] px-5 py-3 text-sm font-semibold text-[#22301f] shadow-[5px_5px_10px_#b7c4b5,-5px_-5px_10px_#ffffff] transition hover:bg-[#7CA982] disabled:opacity-55";
const secondary =
  "rounded-2xl bg-[#F7F6F2] px-4 py-3 text-sm font-medium text-[#3d4a42] shadow-[5px_5px_10px_#d3d9d0,-5px_-5px_10px_#ffffff] transition hover:bg-[#edf1e9] disabled:opacity-55";

interface DeliveryForm {
  distanceKm: string;
  cashCollectedAmount: string;
  signatureUrl: string;
  note: string;
}

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

function expectedCash(
  order: DashboardOrder,
  settings: DeliverySettingsRow,
  distanceInput: string,
): number | null {
  if (order.transport_calculated_at) {
    return asNumber(order.final_total);
  }
  if (!isTransportConfigured(settings)) return null;
  if (distanceInput === "") return null;
  const distance = Number(distanceInput);
  if (!Number.isFinite(distance) || distance < 0) return null;
  const transport = calculateTransportCost(distance, getTransportTierConfig(settings));
  return Number((asNumber(order.total_food_cost) + transport).toFixed(2));
}

function makeForm(order: DashboardOrder, settings: DeliverySettingsRow): DeliveryForm {
  const distanceKm =
    order.distance_km === null || order.distance_km === undefined
      ? ""
      : String(order.distance_km);
  const expected = expectedCash(order, settings, distanceKm);
  return {
    distanceKm,
    cashCollectedAmount: expected === null ? "" : expected.toFixed(2),
    signatureUrl: "",
    note: "",
  };
}

function buildForms(data: DashboardData): Record<string, DeliveryForm> {
  const forms: Record<string, DeliveryForm> = {};
  for (const order of data.orders) {
    if (order.status === "DISPATCHED") {
      forms[order.id] = makeForm(order, data.settings);
    }
  }
  return forms;
}

function mergeForms(
  previous: Record<string, DeliveryForm>,
  data: DashboardData,
): Record<string, DeliveryForm> {
  const next = buildForms(data);
  for (const id of Object.keys(next)) {
    if (previous[id]) {
      next[id] = {
        ...next[id],
        signatureUrl: previous[id].signatureUrl,
        note: previous[id].note,
      };
    }
  }
  return next;
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function OrderSummary({ order }: { order: DashboardOrder }) {
  return (
    <article className={`${neu} flex flex-wrap items-center justify-between gap-3 p-4`}>
      <div>
        <p className="font-mono text-xs text-[#6f7a74]">Order #{shortId(order.id)}</p>
        <p className="mt-1 text-sm font-semibold">
          {order.customer?.name ?? "Customer"} · {order.delivery_address ?? "No address"}
        </p>
      </div>
      <div className="flex items-center gap-3">
        <p className="font-display text-lg font-bold">{formatAmount(order.final_total)}</p>
        <StatusBadge status={order.status} />
      </div>
    </article>
  );
}

export default function DriverPortal({ initialData }: { initialData: DashboardData }) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(initialData);
  const [forms, setForms] = useState<Record<string, DeliveryForm>>(() => buildForms(initialData));
  const [busyOrder, setBusyOrder] = useState<string | null>(null);
  const [globalBusy, setGlobalBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const isAdmin = data.actor.role === "ADMIN";
  const relevantOrders = data.orders.filter(
    (order) => isAdmin || order.driver_id === data.actor.id,
  );
  const deliverableOrders = relevantOrders.filter((order) => order.status === "DISPATCHED");
  const waitingOrders = relevantOrders.filter(
    (order) => order.status !== "DISPATCHED" && order.status !== "DELIVERED" && order.status !== "CLOSED",
  );
  const deliveredOrders = relevantOrders.filter((order) => order.status === "DELIVERED");
  const closedOrders = relevantOrders.filter((order) => order.status === "CLOSED").slice(0, 5);
  const rateConfigured = isTransportConfigured(data.settings);
  const transportTiers = getTransportTierConfig(data.settings);

  function updateForm(order: DashboardOrder, patch: Partial<DeliveryForm>) {
    setForms((previous) => {
      const current = previous[order.id] ?? makeForm(order, data.settings);
      const next = { ...current, ...patch };
      if (Object.prototype.hasOwnProperty.call(patch, "distanceKm")) {
        const expected = expectedCash(order, data.settings, next.distanceKm);
        next.cashCollectedAmount = expected === null ? "" : expected.toFixed(2);
      }
      return { ...previous, [order.id]: next };
    });
  }

  async function refreshData() {
    setGlobalBusy(true);
    setMessage(null);
    const result = await getDashboardDataAction();
    if (result.ok) {
      setData(result.data);
      setForms((previous) => mergeForms(previous, result.data));
      setMessage("Assignments refreshed.");
      notify.success("Assignments updated", "Latest driver orders loaded.");
    } else {
      const failure = `[${result.code}] ${result.error}`;
      setMessage(failure);
      notify.error("Refresh failed", failure);
    }
    setGlobalBusy(false);
    router.refresh();
  }

  async function signOut() {
    setGlobalBusy(true);
    const result = await signOutAction();
    setGlobalBusy(false);
    if (!result.ok) {
      const failure = `[${result.code}] ${result.error}`;
      setMessage(failure);
      notify.error("Sign-out failed", failure);
      return;
    }
    router.push("/driver/login");
    router.refresh();
  }

  async function submitDelivery(order: DashboardOrder) {
    const form = forms[order.id];
    if (!form?.signatureUrl) {
      setMessage("Ask the customer to draw a signature before recording delivery.");
      return;
    }
    const expected = expectedCash(order, data.settings, form.distanceKm);
    if (expected === null) {
      setMessage(
        order.transport_calculated_at
          ? "This order has no final total. Ask Admin to configure the rate."
          : "Enter a delivery distance, and ask Admin to configure the transport rate.",
      );
      return;
    }
    const cash = Number(form.cashCollectedAmount);
    if (!Number.isFinite(cash) || Math.abs(cash - expected) > 0.009) {
      setMessage(`Cash collected must equal the expected total ${expected.toFixed(2)}.`);
      return;
    }

    let distanceKm: number;
    if (order.transport_calculated_at) {
      distanceKm =
        order.distance_km === null || order.distance_km === undefined
          ? 0
          : asNumber(order.distance_km);
    } else {
      distanceKm = Number(form.distanceKm);
    }
    if (!Number.isFinite(distanceKm) || distanceKm < 0) {
      setMessage("Enter a valid delivery distance.");
      return;
    }

    setBusyOrder(order.id);
    setMessage(null);
    const result = await recordDeliveryAction({
      orderId: order.id,
      distanceKm,
      signatureUrl: form.signatureUrl,
      cashCollectedAmount: cash,
      expectedStatus: order.status,
      expectedVersion: order.version,
      note: form.note || undefined,
    });
    setBusyOrder(null);
    if (!result.ok) {
      const failure = `[${result.code}] ${result.error}`;
      setMessage(failure);
      notify.error("Delivery not recorded", failure);
      return;
    }
    const success = `Order #${shortId(order.id)} marked delivered.`;
    setMessage(success);
    notify.success("Delivered & Cash Collected", `${success} Signature and cash evidence stored.`);
    const refreshed = await getDashboardDataAction();
    if (refreshed.ok) {
      setData(refreshed.data);
      setForms((previous) => mergeForms(previous, refreshed.data));
    }
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
              <p className="font-display text-lg font-bold">Driver portal</p>
              <p className="text-xs text-[#6f7a74]">
                {data.actor.name} · {data.roleLabels[data.actor.role]}
              </p>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/pos" className={secondary}>
              POS dashboard
            </Link>
            <Link href="/orders" className={secondary}>
              My orders
            </Link>
            <Link href="/" className={secondary}>
              Catalog
            </Link>
            <button type="button" onClick={refreshData} disabled={globalBusy} className={secondary}>
              Refresh
            </button>
            <button type="button" onClick={signOut} disabled={globalBusy} className={secondary}>
              Sign out
            </button>
          </div>
        </header>

        <section className={`${neu} flex flex-wrap items-center justify-between gap-3 p-5`}>
          <div>
            <h1 className="font-display text-xl font-bold">
              {deliverableOrders.length} delivery{deliverableOrders.length === 1 ? "" : "ies"} ready
            </h1>
            <p className="mt-1 text-sm text-[#6f7a74]">
              {rateConfigured ? (
                <>
                  {transportTiers.currency} tiered transport · {TRANSPORT_TIER_LABELS[0]}
                </>
              ) : (
                "Transport rate not configured"
              )}
            </p>
          </div>
          {!rateConfigured ? (
            <span className="rounded-full bg-[#f4e7c9] px-3 py-2 text-xs font-bold text-[#7a5b1d]">
              Admin must set transport rate
            </span>
          ) : (
            <span className="rounded-full bg-[#dcead7] px-3 py-2 text-xs font-bold text-[#3f6b45]">
              Live billing active
            </span>
          )}
        </section>

        {rateConfigured ? (
          <section className={`${inset} grid gap-2 px-5 py-4 text-xs text-[#59645e] sm:grid-cols-2`}>
            {TRANSPORT_TIER_LABELS.map((label) => (
              <p key={label}>{label}</p>
            ))}
          </section>
        ) : null}

        {message ? (
          <div className="rounded-2xl bg-[#dcead7] px-5 py-4 text-sm font-medium text-[#3f6b45]">
            {message}
          </div>
        ) : null}

        {deliverableOrders.length === 0 ? (
          <section className={`${neu} p-8 text-center`}>
            <h2 className="font-display text-xl font-bold">No deliveries ready</h2>
            <p className="mt-2 text-sm text-[#6f7a74]">
              Dispatched orders assigned to you will appear here.
            </p>
          </section>
        ) : (
          <div className="space-y-5">
            {deliverableOrders.map((order) => {
              const form = forms[order.id] ?? makeForm(order, data.settings);
              const expected = expectedCash(order, data.settings, form.distanceKm);
              const distanceLocked =
                order.distance_km !== null && order.distance_km !== undefined;
              const canSubmit =
                expected !== null &&
                form.signatureUrl.length > 0 &&
                busyOrder === null &&
                !globalBusy;
              const foodAmount = asNumber(order.total_food_cost);
              const transportAmount =
                expected === null ? 0 : Math.max(0, expected - foodAmount);
              const distanceValue =
                form.distanceKm === "" ? null : Number(form.distanceKm);
              return (
                <article key={order.id} className={`${neu} p-5 sm:p-6`}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <p className="font-mono text-xs text-[#6f7a74]">Order #{shortId(order.id)}</p>
                      <h2 className="mt-1 font-display text-xl font-bold">
                        {order.customer?.name ?? "Customer"}
                      </h2>
                      <p className="mt-1 text-sm text-[#6f7a74]">
                        {order.delivery_address ?? "No delivery address"}
                      </p>
                      <p className="mt-1 text-xs text-[#6f7a74]">
                        Dispatched {formatDate(order.dispatched_at)}
                      </p>
                    </div>
                    <StatusBadge status={order.status} />
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-3">
                    <div className={`${inset} px-4 py-3`}>
                      <p className="text-xs uppercase tracking-widest text-[#7b857f]">Food</p>
                      <p className="mt-1 font-display text-lg font-bold">
                        {formatAmount(order.total_food_cost)}
                      </p>
                    </div>
                    <div className={`${inset} px-4 py-3`}>
                      <p className="text-xs uppercase tracking-widest text-[#7b857f]">Transport</p>
                      <p className="mt-1 font-display text-lg font-bold">
                        {order.transport_calculated_at
                          ? formatAmount(order.transport_cost)
                          : expected === null
                            ? "Pending"
                            : (expected - asNumber(order.total_food_cost)).toFixed(2)}
                      </p>
                    </div>
                    <div className={`${inset} px-4 py-3`}>
                      <p className="text-xs uppercase tracking-widest text-[#7b857f]">Collect</p>
                      <p className="mt-1 font-display text-lg font-bold">
                        {expected === null ? "Pending" : expected.toFixed(2)}
                      </p>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
                    <DeliveryMapPlaceholder
                      status={order.status}
                      address={order.delivery_address}
                      distanceKm={
                        distanceValue !== null && Number.isFinite(distanceValue)
                          ? distanceValue
                          : order.distance_km === null
                            ? null
                            : asNumber(order.distance_km)
                      }
                    />
                    <EBill
                      order={order}
                      settings={data.settings}
                      foodTotal={foodAmount}
                      transportCost={transportAmount}
                      finalTotal={expected ?? order.final_total}
                      distanceKm={
                        distanceValue !== null && Number.isFinite(distanceValue)
                          ? distanceValue
                          : order.distance_km === null
                            ? null
                            : asNumber(order.distance_km)
                      }
                      schema={data.schema}
                      compact
                      showActions={false}
                      heading="Final e-bill · live"
                    />
                  </div>

                  <div className="mt-5 grid gap-5 lg:grid-cols-2">
                    <div className="space-y-4">
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                          Delivery distance (km)
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputClass}
                          value={form.distanceKm}
                          disabled={busyOrder === order.id || globalBusy || distanceLocked || Boolean(order.transport_calculated_at)}
                          onChange={(event) =>
                            updateForm(order, { distanceKm: event.target.value })
                          }
                          placeholder={`${transportTiers.currency} ${transportTiers.baseRate.toFixed(2)} up to ${transportTiers.baseDistanceKm} km`}
                        />
                      </label>
                      {order.transport_calculated_at ? (
                        <p className={`${inset} px-4 py-3 text-xs text-[#6f7a74]`}>
                          Transport was already calculated at {formatDate(order.transport_calculated_at)}.
                          Collect {formatAmount(order.final_total)}.
                        </p>
                      ) : distanceLocked ? (
                        <p className={`${inset} px-4 py-3 text-xs text-[#6f7a74]`}>
                          Distance is locked to the value already recorded on this order.
                        </p>
                      ) : null}
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                          Cash collected
                        </span>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          className={inputClass}
                          value={form.cashCollectedAmount}
                          disabled={busyOrder === order.id || globalBusy}
                          onChange={(event) =>
                            updateForm(order, { cashCollectedAmount: event.target.value })
                          }
                          placeholder={expected === null ? "Pending" : expected.toFixed(2)}
                        />
                      </label>
                      <label className="block">
                        <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                          Delivery note (optional)
                        </span>
                        <input
                          className={inputClass}
                          value={form.note}
                          disabled={busyOrder === order.id || globalBusy}
                          onChange={(event) => updateForm(order, { note: event.target.value })}
                          placeholder="Gate code, handover note, etc."
                        />
                      </label>
                    </div>

                    <div className="space-y-4">
                      <SignaturePad
                        value={form.signatureUrl}
                        onChange={(value) => updateForm(order, { signatureUrl: value })}
                        disabled={busyOrder === order.id || globalBusy}
                      />
                      <button
                        type="button"
                        onClick={() => submitDelivery(order)}
                        disabled={!canSubmit}
                        className={`${primary} w-full`}
                      >
                        {busyOrder === order.id
                          ? "Recording delivery…"
                          : expected === null
                            ? "Awaiting transport setup"
                            : `Delivered & Cash Collected · ${expected.toFixed(2)}`}
                      </button>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        )}

        {waitingOrders.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
              Awaiting dispatch
            </h2>
            {waitingOrders.map((order) => (
              <OrderSummary key={order.id} order={order} />
            ))}
          </section>
        ) : null}

        {deliveredOrders.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
              Delivered · awaiting settlement
            </h2>
            {deliveredOrders.map((order) => (
              <OrderSummary key={order.id} order={order} />
            ))}
          </section>
        ) : null}

        {closedOrders.length > 0 ? (
          <section className="space-y-3">
            <h2 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
              Recently closed
            </h2>
            {closedOrders.map((order) => (
              <OrderSummary key={order.id} order={order} />
            ))}
          </section>
        ) : null}

        <footer className="pb-4 text-center text-xs text-[#7b857f]">
          MacroBox driver portal · Live {data.schema} · {formatDate(data.generatedAt)}
        </footer>
      </div>
    </main>
  );
}
