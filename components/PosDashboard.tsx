"use client";

import Image from "next/image";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import SignaturePad from "@/components/SignaturePad";
import { signOutAction } from "@/app/actions/auth";
import {
  assignDriverAction,
  clearTransportRateAction,
  createCategoryAction,
  createOrderAction,
  dispatchOrderAction,
  getDashboardDataAction,
  recordDeliveryAction,
  setProductVisibilityAction,
  setTransportRateAction,
  settleOrderAction,
  transitionOrderStatusAction,
  upsertProductAction,
} from "@/app/actions/pos";
import type {
  DashboardData,
  DashboardOrder,
  DirectoryUser,
} from "@/lib/pos/dashboard-types";
import {
  ORDER_STATUSES,
  type ActionResult,
  type AppRole,
  type CategoryRow,
  type DecimalValue,
  type JsonObject,
  type JsonValue,
  type OrderStatus,
  type ProductRow,
} from "@/lib/pos/types";

const TABS = ["overview", "orders", "new", "menu", "settings", "audit"] as const;
type Tab = (typeof TABS)[number];

const SIMPLE_STATUSES: OrderStatus[] = ["ACCEPTED", "PREPARING", "READY"];
const FINAL_STATUSES: OrderStatus[] = ["DELIVERED", "CLOSED"];

const STATUS_STYLES: Record<OrderStatus, string> = {
  PENDING: "bg-[#f4e7c9] text-[#7a5b1d]",
  ACCEPTED: "bg-[#e2eccd] text-[#4d6b30]",
  PREPARING: "bg-[#f7dfc8] text-[#8a542b]",
  READY: "bg-[#d8ead9] text-[#3f6b45]",
  DISPATCHED: "bg-[#d7e5ef] text-[#345d75]",
  DELIVERED: "bg-[#dce9d6] text-[#4a6c3c]",
  CLOSED: "bg-[#e5e3de] text-[#5b5e5a]",
};

const STATUS_LABELS: Record<OrderStatus, string> = {
  PENDING: "Pending",
  ACCEPTED: "Accepted",
  PREPARING: "Preparing",
  READY: "Ready",
  DISPATCHED: "Dispatched",
  DELIVERED: "Delivered",
  CLOSED: "Closed",
};

const neu =
  "rounded-[1.75rem] bg-[#DCE6DA] shadow-[10px_10px_20px_#b7c4b5,-10px_-10px_20px_#ffffff]";
const neuSmall =
  "rounded-2xl bg-[#DCE6DA] shadow-[7px_7px_14px_#b7c4b5,-7px_-7px_14px_#ffffff]";
const inset =
  "rounded-2xl bg-[#DCE6DA] shadow-[inset_7px_7px_14px_#b7c4b5,inset_-7px_-7px_14px_#ffffff]";
const inputClass = `w-full border-0 px-4 py-3 text-sm text-[#2E3033] outline-none placeholder:text-[#9aa49e] ${inset}`;
const primary =
  "rounded-2xl bg-[#8FBC8F] px-4 py-3 text-sm font-semibold text-[#223028] shadow-[5px_5px_10px_#a9b9a7,-5px_-5px_10px_#ffffff] transition hover:bg-[#7CA982] disabled:cursor-not-allowed disabled:opacity-55";
const secondary =
  "rounded-2xl bg-[#F7F6F2] px-4 py-3 text-sm font-medium text-[#3d4a42] shadow-[5px_5px_10px_#d3d9d0,-5px_-5px_10px_#ffffff] transition hover:bg-[#edf1e9] disabled:cursor-not-allowed disabled:opacity-55";
const quiet =
  "rounded-2xl px-4 py-2 text-xs font-semibold uppercase tracking-widest text-[#6f7a74] transition hover:text-[#3f6b45] disabled:opacity-50";

interface PosDashboardProps {
  initialData: DashboardData;
}

interface NewOrderFormState {
  customerId: string;
  items: Record<string, number>;
  deliveryAddress: string;
  deliveryNotes: string;
}

interface DeliveryFormState {
  distanceKm: string;
  signatureUrl: string;
  cashCollectedAmount: string;
  driverId: string;
  note: string;
}

interface DispatchFormState {
  driverId: string;
  note: string;
}

interface RateFormState {
  perKmRate: string;
  freeDistanceKm: string;
}

interface CategoryFormState {
  name: string;
  slug: string;
  description: string;
  sortOrder: string;
  isActive: boolean;
}

interface ProductFormState {
  id: string;
  title: string;
  categoryId: string;
  ingredients: string;
  macros: string;
  basePrice: string;
  isActive: boolean;
}

function asNumber(value: DecimalValue | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatAmount(value: DecimalValue | string | null | undefined): string {
  return asNumber(value).toFixed(2);
}

function formatProductPrice(value: DecimalValue): string {
  return asNumber(value) === 0 ? "Price pending" : formatAmount(value);
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

function parseJsonArray(value: string): JsonValue[] | null {
  try {
    const parsed: unknown = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? (parsed as JsonValue[]) : null;
  } catch {
    return null;
  }
}

function parseJsonObject(value: string): JsonObject | null {
  try {
    const parsed: unknown = JSON.parse(value || "{}");
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as JsonObject;
    }
    return null;
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span className={`inline-flex rounded-full px-3 py-1 text-xs font-bold ${STATUS_STYLES[status]}`}>
      {STATUS_LABELS[status]}
    </span>
  );
}

function StatCard({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className={`${neuSmall} p-5`}>
      <p className="text-xs font-semibold uppercase tracking-widest text-[#7b857f]">{label}</p>
      <p className="mt-3 font-display text-3xl font-bold text-[#2E3033]">{value}</p>
      {hint ? <p className="mt-2 text-xs leading-5 text-[#6f7a74]">{hint}</p> : null}
    </div>
  );
}

function SectionCard({
  title,
  subtitle,
  children,
  action,
}: {
  title: string;
  subtitle?: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <section className={`${neu} p-5 sm:p-6`}>
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold text-[#2E3033]">{title}</h2>
          {subtitle ? <p className="mt-1 text-sm text-[#6f7a74]">{subtitle}</p> : null}
        </div>
        {action}
      </div>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block space-y-2 text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ActionButton({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?: "primary" | "secondary" | "quiet";
  type?: "button" | "submit";
}) {
  const className =
    variant === "primary" ? primary : variant === "secondary" ? secondary : quiet;
  return (
    <button type={type} onClick={onClick} disabled={disabled} className={className}>
      {children}
    </button>
  );
}

function EmptyState({ title, hint }: { title: string; hint?: string }) {
  return (
    <div className={`${inset} px-5 py-8 text-center`}>
      <p className="font-display text-lg font-bold text-[#3d4a42]">{title}</p>
      {hint ? <p className="mt-2 text-sm text-[#6f7a74]">{hint}</p> : null}
    </div>
  );
}

function directoryName(user: DirectoryUser | null | undefined, fallbackId?: string | null) {
  return user?.name || user?.email || shortId(fallbackId);
}

export default function PosDashboard({ initialData }: PosDashboardProps) {
  const router = useRouter();
  const [data, setData] = useState<DashboardData>(initialData);
  const [tab, setTab] = useState<Tab>("overview");
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(
    initialData.orders[0]?.id ?? null,
  );
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [newOrder, setNewOrder] = useState<NewOrderFormState>({
    customerId: initialData.actor.role === "CUSTOMER" ? initialData.actor.id : "",
    items: {},
    deliveryAddress: "",
    deliveryNotes: "",
  });
  const [dispatchForm, setDispatchForm] = useState<DispatchFormState>({
    driverId: "",
    note: "",
  });
  const [deliveryForm, setDeliveryForm] = useState<DeliveryFormState>({
    distanceKm: "",
    signatureUrl: "",
    cashCollectedAmount: "",
    driverId: "",
    note: "",
  });
  const [settlementRef, setSettlementRef] = useState("");
  const [overrideStatus, setOverrideStatus] = useState<OrderStatus>("ACCEPTED");
  const [rateForm, setRateForm] = useState<RateFormState>({
    perKmRate: "",
    freeDistanceKm: "",
  });
  const [categoryForm, setCategoryForm] = useState<CategoryFormState>({
    name: "",
    slug: "",
    description: "",
    sortOrder: "0",
    isActive: true,
  });
  const [productForm, setProductForm] = useState<ProductFormState>({
    id: "",
    title: "",
    categoryId: "",
    ingredients: "[]",
    macros: "{}",
    basePrice: "",
    isActive: true,
  });

  const role = data.actor.role;
  const isAdmin = role === "ADMIN";
  const canManage = isAdmin || role === "MANAGER";
  const canFront = canManage || role === "FRONT_DESK";
  const canKitchen = isAdmin || role === "MANAGER" || role === "KITCHEN";
  const canDriver = isAdmin || role === "DRIVER";
  const canCreateOrder = isAdmin || role === "MANAGER" || role === "FRONT_DESK" || role === "CUSTOMER";

  const selectedOrder = useMemo(
    () => data.orders.find((order) => order.id === selectedOrderId) ?? data.orders[0] ?? null,
    [data.orders, selectedOrderId],
  );

  const activeProducts = useMemo(
    () => data.products.filter((product) => product.is_active),
    [data.products],
  );

  const userMap = useMemo(() => {
    const map = new Map<string, string>();
    data.users.forEach((user) => map.set(user.id, user.name || user.email || shortId(user.id)));
    return map;
  }, [data.users]);

  const kpis = useMemo(() => {
    const count = (status: OrderStatus) => data.orders.filter((o) => o.status === status).length;
    const active = data.orders.filter((o) => !FINAL_STATUSES.includes(o.status)).length;
    const collected = data.orders
      .filter((o) => o.status === "DELIVERED" || o.status === "CLOSED")
      .reduce((sum, o) => sum + asNumber(o.final_total), 0);
    return {
      total: data.orders.length,
      pending: count("PENDING"),
      active,
      delivered: count("DELIVERED"),
      closed: count("CLOSED"),
      collected,
    };
  }, [data.orders]);

  useEffect(() => {
    setRateForm({
      perKmRate:
        data.settings.per_km_rate === null ? "" : String(asNumber(data.settings.per_km_rate)),
      freeDistanceKm: String(asNumber(data.settings.free_distance_km)),
    });
  }, [data.settings]);

  useEffect(() => {
    if (!selectedOrder) return;
    setDispatchForm((prev) => ({
      ...prev,
      driverId: selectedOrder.driver_id || data.drivers[0]?.id || "",
    }));
    setDeliveryForm((prev) => ({
      ...prev,
      distanceKm:
        selectedOrder.distance_km === null ? "" : String(asNumber(selectedOrder.distance_km)),
      signatureUrl: selectedOrder.delivery_signature_url || "",
      cashCollectedAmount:
        selectedOrder.cash_collected_amount === null
          ? formatAmount(selectedOrder.final_total)
          : String(asNumber(selectedOrder.cash_collected_amount)),
      driverId:
        selectedOrder.driver_id || (role === "DRIVER" ? data.actor.id : data.drivers[0]?.id || ""),
    }));
    setSettlementRef(selectedOrder.cash_settlement_reference || "");
    const next = ORDER_STATUSES.find((status) => status !== selectedOrder.status);
    if (next) setOverrideStatus(next);
  }, [selectedOrder?.id, selectedOrder?.status, selectedOrder?.version, data.drivers, data.actor.id, role]);

  async function refreshData() {
    const result = await getDashboardDataAction();
    if (result.ok) {
      setData(result.data);
      if (!result.data.orders.some((order) => order.id === selectedOrderId)) {
        setSelectedOrderId(result.data.orders[0]?.id ?? null);
      }
    } else {
      setError(`[${result.code}] ${result.error}`);
    }
    router.refresh();
  }

  async function run<T>(
    label: string,
    fn: () => Promise<ActionResult<T>>,
    successMessage?: string,
  ): Promise<T | null> {
    if (busy) return null;
    setBusy(true);
    setError(null);
    setMessage(null);
    try {
      const result = await fn();
      if (!result.ok) {
        setError(`[${result.code}] ${result.error}`);
        return null;
      }
      setMessage(successMessage ?? `${label} completed.`);
      await refreshData();
      return result.data;
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unexpected error.");
      return null;
    } finally {
      setBusy(false);
    }
  }

  function allowedNextStatuses(order: DashboardOrder): OrderStatus[] {
    if (isAdmin) return ORDER_STATUSES.filter((status) => status !== order.status);
    return data.transitions
      .filter(
        (transition) =>
          transition.from_status === order.status &&
          transition.allowed_roles.includes(role),
      )
      .map((transition) => transition.to_status);
  }

  function expectedFor(order: DashboardOrder) {
    return {
      expectedStatus: order.status,
      expectedVersion: Number(order.version),
    };
  }

  async function handleSignOut() {
    if (busy) return;
    setBusy(true);
    const result = await signOutAction();
    setBusy(false);
    if (!result.ok) {
      setError(`[${result.code}] ${result.error}`);
      return;
    }
    router.push("/login");
    router.refresh();
  }

  function renderOverview() {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Orders" value={String(kpis.total)} hint="Loaded from live Supabase" />
          <StatCard label="Pending" value={String(kpis.pending)} hint="Awaiting acceptance" />
          <StatCard label="Active" value={String(kpis.active)} hint="Not yet delivered/closed" />
          <StatCard
            label="Collected"
            value={formatAmount(kpis.collected)}
            hint="Delivered + closed final totals"
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
          <SectionCard
            title="Recent orders"
            subtitle="Latest 50 orders visible to your role"
            action={<ActionButton variant="secondary" onClick={() => setTab("orders")}>Open orders</ActionButton>}
          >
            {data.orders.length === 0 ? (
              <EmptyState title="No orders yet" hint="Create the first order from the New order tab." />
            ) : (
              <div className="space-y-3">
                {data.orders.slice(0, 6).map((order) => (
                  <button
                    key={order.id}
                    type="button"
                    onClick={() => {
                      setSelectedOrderId(order.id);
                      setTab("orders");
                    }}
                    className={`${inset} flex w-full items-center justify-between gap-4 px-4 py-3 text-left transition hover:bg-[#e3ebe0]`}
                  >
                    <div>
                      <p className="font-mono text-xs text-[#6f7a74]">#{shortId(order.id)}</p>
                      <p className="mt-1 text-sm font-semibold text-[#2E3033]">
                        {directoryName(order.customer, order.customer_id)}
                      </p>
                    </div>
                    <div className="text-right">
                      <StatusBadge status={order.status} />
                      <p className="mt-2 text-sm font-semibold">{formatAmount(order.final_total)}</p>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Live connection" subtitle="Database-enforced POS core">
            <div className="space-y-4 text-sm leading-6 text-[#4b5550]">
              <div className={`${inset} px-4 py-3`}>
                <span className="font-semibold">Schema:</span> {data.schema}
              </div>
              <div className={`${inset} px-4 py-3`}>
                <span className="font-semibold">Signed in as:</span> {data.actor.name}{" "}
                <span className="text-[#6f7a74]">({data.roleLabels[role]})</span>
              </div>
              <div className={`${inset} px-4 py-3`}>
                <span className="font-semibold">Transport rate:</span>{" "}
                {data.settings.per_km_rate === null
                  ? "Not configured"
                  : `${formatAmount(data.settings.per_km_rate)} / km`}
              </div>
              <div className={`${inset} px-4 py-3`}>
                <span className="font-semibold">Free distance:</span>{" "}
                {formatAmount(data.settings.free_distance_km)} km
              </div>
              <p className="text-xs leading-5 text-[#7b857f]">
                Product prices marked “Price pending” are 0.00 placeholders. Set approved
                prices in the Menu tab before taking real orders.
              </p>
            </div>
          </SectionCard>
        </div>
      </div>
    );
  }

  function renderSimpleTransitions(order: DashboardOrder) {
    const allowed = allowedNextStatuses(order);
    const buttons = SIMPLE_STATUSES.filter((status) => allowed.includes(status));
    if (buttons.length === 0) return null;

    return (
      <div className="space-y-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
          Standard transitions
        </h3>
        <div className="flex flex-wrap gap-2">
          {buttons.map((status) => (
            <ActionButton
              key={status}
              disabled={busy}
              onClick={() =>
                run(
                  `Move to ${STATUS_LABELS[status]}`,
                  () =>
                    transitionOrderStatusAction({
                      orderId: order.id,
                      toStatus: status,
                      ...expectedFor(order),
                      metadata: { note: `Moved to ${STATUS_LABELS[status]} from dashboard` },
                    }),
                  `Order moved to ${STATUS_LABELS[status]}.`,
                )
              }
            >
              Mark {STATUS_LABELS[status]}
            </ActionButton>
          ))}
        </div>
      </div>
    );
  }

  function renderDispatchPanel(order: DashboardOrder) {
    if (!canFront || FINAL_STATUSES.includes(order.status)) return null;
    const drivers = data.drivers;

    return (
      <div className="space-y-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
          Driver &amp; dispatch
        </h3>
        {drivers.length === 0 ? (
          <p className="text-sm text-[#8a3b2f]">No active drivers are available.</p>
        ) : (
          <>
            <Field label="Driver">
              <select
                className={inputClass}
                value={dispatchForm.driverId || drivers[0]?.id || ""}
                onChange={(event) =>
                  setDispatchForm((prev) => ({ ...prev, driverId: event.target.value }))
                }
              >
                {drivers.map((driver) => (
                  <option key={driver.id} value={driver.id}>
                    {driver.name || driver.email || shortId(driver.id)}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Note (optional)">
              <input
                className={inputClass}
                value={dispatchForm.note}
                onChange={(event) =>
                  setDispatchForm((prev) => ({ ...prev, note: event.target.value }))
                }
                placeholder="Dispatch note"
              />
            </Field>
            <div className="flex flex-wrap gap-2">
              {canManage ? (
                <ActionButton
                  variant="secondary"
                  disabled={busy}
                  onClick={() =>
                    run(
                      "Assign driver",
                      () =>
                        assignDriverAction({
                          orderId: order.id,
                          driverId: dispatchForm.driverId || drivers[0].id,
                          dispatch: false,
                          ...expectedFor(order),
                        }),
                      "Driver assigned.",
                    )
                  }
                >
                  Assign only
                </ActionButton>
              ) : null}
              <ActionButton
                disabled={busy}
                onClick={() => {
                  const driverId = dispatchForm.driverId || drivers[0].id;
                  return run(
                    "Dispatch order",
                    () =>
                      canManage
                        ? assignDriverAction({
                            orderId: order.id,
                            driverId,
                            dispatch: true,
                            ...expectedFor(order),
                          })
                        : dispatchOrderAction({
                            orderId: order.id,
                            driverId,
                            ...expectedFor(order),
                            ...(dispatchForm.note.trim() ? { note: dispatchForm.note.trim() } : {}),
                          }),
                    "Order dispatched.",
                  );
                }}
              >
                Assign &amp; dispatch
              </ActionButton>
            </div>
            {!canManage && order.status !== "READY" ? (
              <p className="text-xs text-[#8a542b]">
                Front Desk dispatch normally requires READY status. Admin can override.
              </p>
            ) : null}
          </>
        )}
      </div>
    );
  }

  function expectedCash(order: DashboardOrder, distanceKm: number): number {
    const rate = data.settings.per_km_rate;
    if (rate === null) return asNumber(order.total_food_cost);
    const free = asNumber(data.settings.free_distance_km);
    const transport = Math.max(distanceKm - free, 0) * asNumber(rate);
    return asNumber(order.total_food_cost) + transport;
  }

  function renderDeliveryPanel(order: DashboardOrder) {
    if (!canDriver || FINAL_STATUSES.includes(order.status)) return null;
    const distance = Number(deliveryForm.distanceKm || 0);
    const expected = expectedCash(order, Number.isFinite(distance) ? distance : 0);
    const rateMissing = data.settings.per_km_rate === null;

    return (
      <div className="space-y-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
          Delivery evidence &amp; cash
        </h3>
        {rateMissing ? (
          <div className="rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm text-[#8a3b2f]">
            Admin has not configured the per-km rate. Delivery will be rejected until it is set.
          </div>
        ) : null}
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Distance (km)">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={deliveryForm.distanceKm}
              onChange={(event) => {
                const value = event.target.value;
                const nextDistance = Number(value || 0);
                setDeliveryForm((prev) => ({
                  ...prev,
                  distanceKm: value,
                  cashCollectedAmount: expectedCash(
                    order,
                    Number.isFinite(nextDistance) ? nextDistance : 0,
                  ).toFixed(2),
                }));
              }}
              placeholder="0.00"
            />
          </Field>
          <Field label="Cash collected">
            <input
              type="number"
              min="0"
              step="0.01"
              className={inputClass}
              value={deliveryForm.cashCollectedAmount}
              onChange={(event) =>
                setDeliveryForm((prev) => ({ ...prev, cashCollectedAmount: event.target.value }))
              }
              placeholder={expected.toFixed(2)}
            />
          </Field>
        </div>
        <p className="text-xs text-[#6f7a74]">
          Expected cash after transport: <span className="font-semibold">{expected.toFixed(2)}</span>
        </p>
        <SignaturePad
          value={deliveryForm.signatureUrl}
          onChange={(value) =>
            setDeliveryForm((prev) => ({ ...prev, signatureUrl: value }))
          }
          disabled={busy}
        />
        {isAdmin ? (
          <Field label="Delivering driver">
            <select
              className={inputClass}
              value={deliveryForm.driverId}
              onChange={(event) =>
                setDeliveryForm((prev) => ({ ...prev, driverId: event.target.value }))
              }
            >
              <option value="">Use assigned driver</option>
              {data.drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.name || driver.email || shortId(driver.id)}
                </option>
              ))}
            </select>
          </Field>
        ) : null}
        <Field label="Note (optional)">
          <input
            className={inputClass}
            value={deliveryForm.note}
            onChange={(event) =>
              setDeliveryForm((prev) => ({ ...prev, note: event.target.value }))
            }
            placeholder="Delivery note"
          />
        </Field>
        <ActionButton
          disabled={busy || rateMissing}
          onClick={() =>
            run(
              "Record delivery",
              () =>
                recordDeliveryAction({
                  orderId: order.id,
                  distanceKm: Number(deliveryForm.distanceKm || 0),
                  signatureUrl: deliveryForm.signatureUrl.trim(),
                  cashCollectedAmount: Number(deliveryForm.cashCollectedAmount || 0),
                  ...(deliveryForm.driverId ? { driverId: deliveryForm.driverId } : {}),
                  ...(deliveryForm.note.trim() ? { note: deliveryForm.note.trim() } : {}),
                  ...expectedFor(order),
                }),
              "Delivery recorded with signature and cash evidence.",
            )
          }
        >
          Record delivered
        </ActionButton>
      </div>
    );
  }

  function renderSettlementPanel(order: DashboardOrder) {
    if (!canManage || order.status !== "DELIVERED") return null;
    return (
      <div className="space-y-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
          Cash settlement
        </h3>
        <Field label="Settlement reference">
          <input
            className={inputClass}
            value={settlementRef}
            onChange={(event) => setSettlementRef(event.target.value)}
            placeholder="e.g. bank deposit / cash handover reference"
          />
        </Field>
        <ActionButton
          disabled={busy || !settlementRef.trim()}
          onClick={() =>
            run(
              "Settle order",
              () =>
                settleOrderAction({
                  orderId: order.id,
                  cashSettlementReference: settlementRef.trim(),
                  ...expectedFor(order),
                }),
              "Order closed and cash settled.",
            )
          }
        >
          Settle &amp; close
        </ActionButton>
      </div>
    );
  }

  function renderAdminOverride(order: DashboardOrder) {
    if (!isAdmin || order.status === "CLOSED") return null;
    const targets = ORDER_STATUSES.filter(
      (status) => status !== order.status && !FINAL_STATUSES.includes(status),
    );
    return (
      <div className="space-y-3">
        <h3 className="font-display text-sm font-bold uppercase tracking-widest text-[#6f7a74]">
          Admin override
        </h3>
        <p className="text-xs leading-5 text-[#6f7a74]">
          Admin may skip normal matrix edges, but delivery/settlement evidence is still enforced.
          Evidence states use the forms above.
        </p>
        <div className="flex flex-wrap items-end gap-2">
          <div className="min-w-[180px] flex-1">
            <Field label="Target status">
              <select
                className={inputClass}
                value={overrideStatus}
                onChange={(event) => setOverrideStatus(event.target.value as OrderStatus)}
              >
                {targets.map((status) => (
                  <option key={status} value={status}>
                    {STATUS_LABELS[status]}
                  </option>
                ))}
              </select>
            </Field>
          </div>
          <ActionButton
            disabled={busy}
            onClick={() =>
              run(
                "Admin override",
                () =>
                  transitionOrderStatusAction({
                    orderId: order.id,
                    toStatus: overrideStatus,
                    ...expectedFor(order),
                    metadata: { note: "Admin override from dashboard" },
                  }),
                `Order overridden to ${STATUS_LABELS[overrideStatus]}.`,
              )
            }
          >
            Apply override
          </ActionButton>
        </div>
      </div>
    );
  }

  function renderOrderDetail(order: DashboardOrder) {
    const items = order.order_items ?? [];
    const history = [...(order.order_status_history ?? [])].sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    );

    return (
      <div className="space-y-6">
        <SectionCard
          title={`Order #${shortId(order.id)}`}
          subtitle={`Created ${formatDate(order.created_at)} · version ${order.version}`}
          action={<StatusBadge status={order.status} />}
        >
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <div className={`${inset} px-4 py-3`}>
              <p className="text-xs uppercase tracking-widest text-[#7b857f]">Customer</p>
              <p className="mt-1 text-sm font-semibold">{directoryName(order.customer, order.customer_id)}</p>
            </div>
            <div className={`${inset} px-4 py-3`}>
              <p className="text-xs uppercase tracking-widest text-[#7b857f]">Driver</p>
              <p className="mt-1 text-sm font-semibold">
                {order.driver_id
                  ? directoryName(order.driver, order.driver_id) || userMap.get(order.driver_id) || shortId(order.driver_id)
                  : "Not assigned"}
              </p>
            </div>
            <div className={`${inset} px-4 py-3`}>
              <p className="text-xs uppercase tracking-widest text-[#7b857f]">Food total</p>
              <p className="mt-1 text-sm font-semibold">{formatAmount(order.total_food_cost)}</p>
            </div>
            <div className={`${inset} px-4 py-3`}>
              <p className="text-xs uppercase tracking-widest text-[#7b857f]">Final total</p>
              <p className="mt-1 text-sm font-semibold">{formatAmount(order.final_total)}</p>
            </div>
          </div>

          <div className="mt-4 grid gap-3 text-sm sm:grid-cols-2">
            <div className={`${inset} px-4 py-3`}>
              <span className="font-semibold">Transport:</span> {formatAmount(order.transport_cost)}
              {order.distance_km !== null ? ` · ${formatAmount(order.distance_km)} km` : ""}
            </div>
            <div className={`${inset} px-4 py-3`}>
              <span className="font-semibold">Cash collected:</span>{" "}
              {order.cash_collected_amount === null
                ? "—"
                : formatAmount(order.cash_collected_amount)}
            </div>
            <div className={`${inset} px-4 py-3 sm:col-span-2`}>
              <span className="font-semibold">Delivery address:</span>{" "}
              {order.delivery_address || "—"}
            </div>
            {order.delivery_notes ? (
              <div className={`${inset} px-4 py-3 sm:col-span-2`}>
                <span className="font-semibold">Notes:</span> {order.delivery_notes}
              </div>
            ) : null}
            {order.delivery_signature_url ? (
              <div className={`${inset} px-4 py-3 sm:col-span-2 break-all`}>
                <span className="font-semibold">Signature:</span> {order.delivery_signature_url}
              </div>
            ) : null}
            {order.cash_settlement_reference ? (
              <div className={`${inset} px-4 py-3 sm:col-span-2`}>
                <span className="font-semibold">Settlement ref:</span>{" "}
                {order.cash_settlement_reference}
              </div>
            ) : null}
          </div>
        </SectionCard>

        <SectionCard title="Items" subtitle="Snapshots are stored at order creation">
          {items.length === 0 ? (
            <EmptyState title="No line items" hint="This order has no product snapshots." />
          ) : (
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.id} className={`${inset} flex items-center justify-between gap-4 px-4 py-3`}>
                  <div>
                    <p className="text-sm font-semibold">{item.title_snapshot}</p>
                    <p className="mt-1 text-xs text-[#6f7a74]">
                      Qty {item.quantity} · Unit {formatAmount(item.unit_price)}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatAmount(item.line_total)}</p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Actions" subtitle="All checks run again inside the SQL state machine">
          <div className="grid gap-6 lg:grid-cols-2">
            <div className="space-y-6">
              {renderSimpleTransitions(order)}
              {renderDispatchPanel(order)}
            </div>
            <div className="space-y-6">
              {renderDeliveryPanel(order)}
              {renderSettlementPanel(order)}
              {renderAdminOverride(order)}
              {!renderSimpleTransitions(order) &&
              !renderDispatchPanel(order) &&
              !renderDeliveryPanel(order) &&
              !renderSettlementPanel(order) &&
              !renderAdminOverride(order) ? (
                <EmptyState
                  title="No actions available"
                  hint="Your role has no permitted transition for this order state."
                />
              ) : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Order timeline" subtitle="Status history and audit metadata">
          {history.length === 0 ? (
            <EmptyState title="No transitions yet" hint="The first status change will appear here." />
          ) : (
            <div className="space-y-3">
              {history.map((entry) => (
                <div key={entry.id} className={`${inset} px-4 py-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {entry.from_status ? STATUS_LABELS[entry.from_status] : "Created"} →{" "}
                      {STATUS_LABELS[entry.to_status]}
                    </p>
                    {entry.is_admin_override ? (
                      <span className="rounded-full bg-[#f4e7c9] px-3 py-1 text-xs font-bold text-[#7a5b1d]">
                        Admin override
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#6f7a74]">
                    {userMap.get(entry.actor_id) || shortId(entry.actor_id)} ·{" "}
                    {data.roleLabels[entry.actor_role]} · {formatDate(entry.created_at)}
                  </p>
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  function renderOrders() {
    return (
      <div className="grid gap-6 xl:grid-cols-[340px_1fr]">
        <SectionCard title="Orders" subtitle={`${data.orders.length} visible`}>
          {data.orders.length === 0 ? (
            <EmptyState title="No orders visible" hint="Create an order or sign in with a staff role." />
          ) : (
            <div className="max-h-[72vh] space-y-3 overflow-y-auto pr-1">
              {data.orders.map((order) => (
                <button
                  key={order.id}
                  type="button"
                  onClick={() => setSelectedOrderId(order.id)}
                  className={`${selectedOrder?.id === order.id ? "bg-[#cfe0cb]" : inset} w-full rounded-2xl px-4 py-3 text-left transition`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <span className="font-mono text-xs text-[#6f7a74]">#{shortId(order.id)}</span>
                    <StatusBadge status={order.status} />
                  </div>
                  <p className="mt-2 text-sm font-semibold">
                    {directoryName(order.customer, order.customer_id)}
                  </p>
                  <p className="mt-1 text-xs text-[#6f7a74]">
                    {formatDate(order.created_at)} · {formatAmount(order.final_total)}
                  </p>
                </button>
              ))}
            </div>
          )}
        </SectionCard>

        <div>
          {selectedOrder ? (
            renderOrderDetail(selectedOrder)
          ) : (
            <SectionCard title="Order detail">
              <EmptyState title="Select an order" hint="Choose an order from the list to see actions." />
            </SectionCard>
          )}
        </div>
      </div>
    );
  }

  function renderNewOrder() {
    if (!canCreateOrder) {
      return (
        <SectionCard title="New order">
          <EmptyState
            title="Order creation not allowed"
            hint="Your role cannot create orders. Admin, Manager, Front Desk, and Customer can."
          />
        </SectionCard>
      );
    }

    const selectedItems = Object.entries(newOrder.items).filter(([, quantity]) => quantity > 0);
    const estimated = selectedItems.reduce((sum, [productId, quantity]) => {
      const product = activeProducts.find((p) => p.id === productId);
      return sum + (product ? asNumber(product.base_price) * quantity : 0);
    }, 0);
    const customerId =
      role === "CUSTOMER" ? data.actor.id : newOrder.customerId || data.customers[0]?.id || "";

    function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const items = selectedItems.map(([productId, quantity]) => ({ productId, quantity }));
      if (items.length === 0 || !customerId) {
        setError("Select a customer and at least one product.");
        return;
      }
      void run(
        "Create order",
        () =>
          createOrderAction({
            customerId,
            items,
            ...(newOrder.deliveryAddress.trim()
              ? { deliveryAddress: newOrder.deliveryAddress.trim() }
              : {}),
            ...(newOrder.deliveryNotes.trim()
              ? { deliveryNotes: newOrder.deliveryNotes.trim() }
              : {}),
          }),
        "Order created in PENDING status.",
      ).then((created) => {
        if (created) {
          setSelectedOrderId(created.id);
          setNewOrder((prev) => ({ ...prev, items: {}, deliveryAddress: "", deliveryNotes: "" }));
          setTab("orders");
        }
      });
    }

    return (
      <SectionCard
        title="New order"
        subtitle="Products are snapshotted in SQL; clients never submit prices."
      >
        <form onSubmit={submit} className="grid gap-6 lg:grid-cols-[1fr_0.8fr]">
          <div className="space-y-5">
            <Field label={role === "CUSTOMER" ? "Customer (your account)" : "Customer"}>
              {role === "CUSTOMER" ? (
                <input className={inputClass} value={data.actor.email || data.actor.name} disabled />
              ) : (
                <select
                  className={inputClass}
                  value={customerId}
                  onChange={(event) =>
                    setNewOrder((prev) => ({ ...prev, customerId: event.target.value }))
                  }
                >
                  <option value="">Select a customer</option>
                  {data.customers.map((customer) => (
                    <option key={customer.id} value={customer.id}>
                      {customer.name || customer.email || shortId(customer.id)}
                    </option>
                  ))}
                </select>
              )}
            </Field>

            <div className="space-y-3">
              <p className="text-xs font-semibold uppercase tracking-widest text-[#6f7a74]">
                Active products
              </p>
              {activeProducts.length === 0 ? (
                <EmptyState title="No active products" hint="Add products in the Menu tab." />
              ) : (
                <div className="max-h-[420px] space-y-3 overflow-y-auto pr-1">
                  {activeProducts.map((product) => {
                    const category = data.categories.find((c) => c.id === product.category_id);
                    const quantity = newOrder.items[product.id] || 0;
                    return (
                      <div key={product.id} className={`${inset} flex items-center justify-between gap-4 px-4 py-3`}>
                        <div>
                          <p className="text-sm font-semibold">
                            {category?.name ? `${category.name} · ` : ""}
                            {product.title}
                          </p>
                          <p className="mt-1 text-xs text-[#6f7a74]">
                            {formatProductPrice(product.base_price)}
                          </p>
                        </div>
                        <input
                          type="number"
                          min="0"
                          max="9999"
                          className={`${inputClass} w-24 text-center`}
                          value={quantity || ""}
                          placeholder="0"
                          onChange={(event) => {
                            const value = Math.max(0, Number(event.target.value || 0));
                            setNewOrder((prev) => ({
                              ...prev,
                              items: { ...prev.items, [product.id]: value },
                            }));
                          }}
                        />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          <div className="space-y-5">
            <Field label="Delivery address (optional)">
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={newOrder.deliveryAddress}
                onChange={(event) =>
                  setNewOrder((prev) => ({ ...prev, deliveryAddress: event.target.value }))
                }
                placeholder="Enter delivery address"
              />
            </Field>
            <Field label="Delivery notes (optional)">
              <textarea
                className={`${inputClass} min-h-24 resize-y`}
                value={newOrder.deliveryNotes}
                onChange={(event) =>
                  setNewOrder((prev) => ({ ...prev, deliveryNotes: event.target.value }))
                }
                placeholder="Notes for the kitchen or driver"
              />
            </Field>
            <div className={`${inset} px-4 py-4`}>
              <p className="text-xs uppercase tracking-widest text-[#7b857f]">Estimated food total</p>
              <p className="mt-2 font-display text-2xl font-bold">{formatAmount(estimated)}</p>
              <p className="mt-2 text-xs leading-5 text-[#6f7a74]">
                0.00 products are placeholders. Transport is calculated only at delivery.
              </p>
            </div>
            <ActionButton type="submit" disabled={busy || selectedItems.length === 0 || !customerId}>
              Create PENDING order
            </ActionButton>
          </div>
        </form>
      </SectionCard>
    );
  }

  function renderMenu() {
    const defaultCategoryId = productForm.categoryId || data.categories[0]?.id || "";

    function submitCategory(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      void run(
        "Create category",
        () =>
          createCategoryAction({
            name: categoryForm.name.trim(),
            slug: categoryForm.slug.trim(),
            ...(categoryForm.description.trim()
              ? { description: categoryForm.description.trim() }
              : {}),
            sortOrder: Number(categoryForm.sortOrder || 0),
            isActive: categoryForm.isActive,
          }),
        "Category created.",
      ).then((created) => {
        if (created) {
          setCategoryForm({
            name: "",
            slug: "",
            description: "",
            sortOrder: "0",
            isActive: true,
          });
        }
      });
    }

    function submitProduct(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      const ingredients = parseJsonArray(productForm.ingredients);
      const macros = parseJsonObject(productForm.macros);
      if (!ingredients || !macros) {
        setError("Ingredients must be a JSON array and macros must be a JSON object.");
        return;
      }
      if (!defaultCategoryId) {
        setError("Create a category first.");
        return;
      }
      void run(
        "Save product",
        () =>
          upsertProductAction({
            ...(productForm.id ? { id: productForm.id } : {}),
            title: productForm.title.trim(),
            categoryId: defaultCategoryId,
            ingredients,
            macros,
            basePrice: Number(productForm.basePrice || 0),
            isActive: productForm.isActive,
          }),
        productForm.id ? "Product updated." : "Product created.",
      ).then((saved) => {
        if (saved) {
          setProductForm({
            id: "",
            title: "",
            categoryId: defaultCategoryId,
            ingredients: "[]",
            macros: "{}",
            basePrice: "",
            isActive: true,
          });
        }
      });
    }

    return (
      <div className="space-y-6">
        <SectionCard
          title="Menu"
          subtitle="Exact supplied catalog copy is preserved. 0.00 means “price pending”."
        >
          {data.products.length === 0 ? (
            <EmptyState title="No products yet" hint="Add a category and product below." />
          ) : (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {data.products.map((product) => {
                const category = data.categories.find((c) => c.id === product.category_id);
                return (
                  <div key={product.id} className={`${inset} space-y-3 p-4`}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs uppercase tracking-widest text-[#7b857f]">
                          {category?.name || "Uncategorised"}
                        </p>
                        <h3 className="mt-1 font-display text-base font-bold">{product.title}</h3>
                      </div>
                      <StatusBadge status={product.is_active ? "READY" : "CLOSED"} />
                    </div>
                    <p className="text-sm font-semibold">{formatProductPrice(product.base_price)}</p>
                    <details className="text-xs text-[#6f7a74]">
                      <summary className="cursor-pointer font-semibold">Ingredients &amp; macros</summary>
                      <pre className="mt-2 max-h-40 overflow-auto whitespace-pre-wrap break-words">
                        {JSON.stringify({ ingredients: product.ingredients, macros: product.macros }, null, 2)}
                      </pre>
                    </details>
                    {isAdmin ? (
                      <div className="space-y-2 pt-2">
                        <form
                          onSubmit={(event) => {
                            event.preventDefault();
                            const form = event.currentTarget;
                            const price = new FormData(form).get("price");
                            void run(
                              "Update price",
                              () =>
                                upsertProductAction({
                                  id: product.id,
                                  title: product.title,
                                  categoryId: product.category_id,
                                  ingredients: product.ingredients as JsonValue[],
                                  macros: product.macros as JsonObject,
                                  basePrice: Number(price || 0),
                                  isActive: product.is_active,
                                }),
                              "Product price updated.",
                            );
                          }}
                          className="flex gap-2"
                        >
                          <input
                            name="price"
                            type="number"
                            min="0"
                            step="0.01"
                            defaultValue={String(asNumber(product.base_price))}
                            key={`${product.id}-${String(product.updated_at)}`}
                            className={`${inputClass} flex-1`}
                            aria-label="Base price"
                          />
                          <ActionButton type="submit" disabled={busy} variant="secondary">
                            Save
                          </ActionButton>
                        </form>
                        <ActionButton
                          variant="quiet"
                          disabled={busy}
                          onClick={() =>
                            run(
                              "Toggle visibility",
                              () =>
                                setProductVisibilityAction({
                                  productId: product.id,
                                  isActive: !product.is_active,
                                }),
                              product.is_active ? "Product hidden." : "Product activated.",
                            )
                          }
                        >
                          {product.is_active ? "Hide product" : "Activate product"}
                        </ActionButton>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </SectionCard>

        {isAdmin ? (
          <div className="grid gap-6 lg:grid-cols-2">
            <SectionCard title="Add category">
              <form onSubmit={submitCategory} className="space-y-4">
                <Field label="Name">
                  <input
                    className={inputClass}
                    value={categoryForm.name}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, name: event.target.value }))
                    }
                    placeholder="e.g. Monday"
                    required
                  />
                </Field>
                <Field label="Slug">
                  <input
                    className={inputClass}
                    value={categoryForm.slug}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, slug: event.target.value }))
                    }
                    placeholder="e.g. monday"
                    required
                  />
                </Field>
                <Field label="Description (optional)">
                  <input
                    className={inputClass}
                    value={categoryForm.description}
                    onChange={(event) =>
                      setCategoryForm((prev) => ({ ...prev, description: event.target.value }))
                    }
                  />
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Sort order">
                    <input
                      type="number"
                      min="0"
                      className={inputClass}
                      value={categoryForm.sortOrder}
                      onChange={(event) =>
                        setCategoryForm((prev) => ({ ...prev, sortOrder: event.target.value }))
                      }
                    />
                  </Field>
                  <label className="flex items-end gap-2 pb-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={categoryForm.isActive}
                      onChange={(event) =>
                        setCategoryForm((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                    Active
                  </label>
                </div>
                <ActionButton type="submit" disabled={busy}>
                  Create category
                </ActionButton>
              </form>
            </SectionCard>

            <SectionCard title="Add / edit product">
              <form onSubmit={submitProduct} className="space-y-4">
                <Field label="Title">
                  <input
                    className={inputClass}
                    value={productForm.title}
                    onChange={(event) =>
                      setProductForm((prev) => ({ ...prev, title: event.target.value }))
                    }
                    placeholder="Exact product name"
                    required
                  />
                </Field>
                <Field label="Category">
                  <select
                    className={inputClass}
                    value={defaultCategoryId}
                    onChange={(event) =>
                      setProductForm((prev) => ({ ...prev, categoryId: event.target.value }))
                    }
                  >
                    {data.categories.map((category: CategoryRow) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <div className="grid grid-cols-2 gap-3">
                  <Field label="Base price">
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      className={inputClass}
                      value={productForm.basePrice}
                      onChange={(event) =>
                        setProductForm((prev) => ({ ...prev, basePrice: event.target.value }))
                      }
                      placeholder="0.00 = price pending"
                    />
                  </Field>
                  <label className="flex items-end gap-2 pb-3 text-sm font-medium">
                    <input
                      type="checkbox"
                      checked={productForm.isActive}
                      onChange={(event) =>
                        setProductForm((prev) => ({ ...prev, isActive: event.target.checked }))
                      }
                    />
                    Active
                  </label>
                </div>
                <Field label="Ingredients JSON array">
                  <textarea
                    className={`${inputClass} min-h-24 font-mono text-xs`}
                    value={productForm.ingredients}
                    onChange={(event) =>
                      setProductForm((prev) => ({ ...prev, ingredients: event.target.value }))
                    }
                  />
                </Field>
                <Field label="Macros JSON object">
                  <textarea
                    className={`${inputClass} min-h-24 font-mono text-xs`}
                    value={productForm.macros}
                    onChange={(event) =>
                      setProductForm((prev) => ({ ...prev, macros: event.target.value }))
                    }
                  />
                </Field>
                <p className="text-xs leading-5 text-[#6f7a74]">
                  No nutrition values are generated here. Paste approved data only.
                </p>
                <ActionButton type="submit" disabled={busy || !defaultCategoryId}>
                  Save product
                </ActionButton>
              </form>
            </SectionCard>
          </div>
        ) : (
          <SectionCard title="Admin only">
            <EmptyState
              title="Read-only menu"
              hint="Only Admin can change prices, visibility, categories, and products."
            />
          </SectionCard>
        )}
      </div>
    );
  }

  function renderSettings() {
    function clearRate() {
      if (!isAdmin) {
        setError("Only Admin can clear the transport rate.");
        return;
      }
      void run(
        "Clear transport rate",
        () => clearTransportRateAction(),
        "Transport rate cleared. Delivery billing is now unconfigured.",
      );
    }

    function submit(event: FormEvent<HTMLFormElement>) {
      event.preventDefault();
      if (!isAdmin) {
        setError("Only Admin can configure the transport rate.");
        return;
      }
      void run(
        "Set transport rate",
        () =>
          setTransportRateAction({
            perKmRate: Number(rateForm.perKmRate || 0),
            ...(rateForm.freeDistanceKm.trim()
              ? { freeDistanceKm: Number(rateForm.freeDistanceKm) }
              : {}),
          }),
        "Transport rate updated.",
      );
    }

    return (
      <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionCard title="Delivery settings" subtitle="Readable by all signed-in roles">
          <div className="space-y-4">
            <div className={`${inset} px-4 py-4`}>
              <p className="text-xs uppercase tracking-widest text-[#7b857f]">Per-km rate</p>
              <p className="mt-2 font-display text-2xl font-bold">
                {data.settings.per_km_rate === null
                  ? "Not configured"
                  : formatAmount(data.settings.per_km_rate)}
              </p>
            </div>
            <div className={`${inset} px-4 py-4`}>
              <p className="text-xs uppercase tracking-widest text-[#7b857f]">Free distance</p>
              <p className="mt-2 font-display text-2xl font-bold">
                {formatAmount(data.settings.free_distance_km)} km
              </p>
            </div>
            <div className={`${inset} px-4 py-4 text-sm leading-6 text-[#4b5550]`}>
              Formula:{" "}
              <span className="font-semibold">
                max(distanceKm − freeDistanceKm, 0) × perKmRate
              </span>
              . No rate is seeded by the migration; Admin must set an approved value.
            </div>
            <p className="text-xs text-[#6f7a74]">Last updated: {formatDate(data.settings.updated_at)}</p>
          </div>
        </SectionCard>

        <SectionCard
          title={isAdmin ? "Configure transport rate" : "Transport rate (Admin only)"}
          subtitle="Used only when a delivery is recorded"
        >
          {isAdmin ? (
            <form onSubmit={submit} className="space-y-4">
              <Field label="Per-km rate">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={rateForm.perKmRate}
                  onChange={(event) =>
                    setRateForm((prev) => ({ ...prev, perKmRate: event.target.value }))
                  }
                  placeholder="Enter approved per-km rate"
                  required
                />
              </Field>
              <Field label="Free distance (km)">
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className={inputClass}
                  value={rateForm.freeDistanceKm}
                  onChange={(event) =>
                    setRateForm((prev) => ({ ...prev, freeDistanceKm: event.target.value }))
                  }
                />
              </Field>
              <div className="flex flex-wrap gap-3">
                <ActionButton type="submit" disabled={busy || !rateForm.perKmRate.trim()}>
                  Save transport settings
                </ActionButton>
                <ActionButton
                  type="button"
                  variant="secondary"
                  onClick={clearRate}
                  disabled={busy || data.settings.per_km_rate === null}
                >
                  Clear rate
                </ActionButton>
              </div>
              {data.settings.per_km_rate !== null ? (
                <p className="text-xs text-[#6f7a74]">
                  Clearing the rate stops new transport calculations without changing past orders.
                </p>
              ) : null}
            </form>
          ) : (
            <EmptyState
              title="Read-only"
              hint="Sign in as Admin to change the per-km rate and free distance."
            />
          )}
        </SectionCard>
      </div>
    );
  }

  function renderAudit() {
    return (
      <div className="grid gap-6 xl:grid-cols-2">
        <SectionCard title="Status history" subtitle={`${data.history.length} recent entries`}>
          {data.history.length === 0 ? (
            <EmptyState title="No history yet" />
          ) : (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {data.history.map((entry) => (
                <div key={entry.id} className={`${inset} px-4 py-3`}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="text-sm font-semibold">
                      {entry.from_status ? STATUS_LABELS[entry.from_status] : "Created"} →{" "}
                      {STATUS_LABELS[entry.to_status]}
                    </p>
                    {entry.is_admin_override ? (
                      <span className="rounded-full bg-[#f4e7c9] px-3 py-1 text-xs font-bold text-[#7a5b1d]">
                        Override
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-1 text-xs text-[#6f7a74]">
                    Order #{shortId(entry.order_id)} · {userMap.get(entry.actor_id) || shortId(entry.actor_id)} ·{" "}
                    {formatDate(entry.created_at)}
                  </p>
                  {Object.keys(entry.metadata || {}).length > 0 ? (
                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[#6f7a74]">
                      {JSON.stringify(entry.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Audit events" subtitle={`${data.events.length} recent entries`}>
          {data.events.length === 0 ? (
            <EmptyState title="No audit events yet" />
          ) : (
            <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1">
              {data.events.map((event) => (
                <div key={event.id} className={`${inset} px-4 py-3`}>
                  <p className="text-sm font-semibold">{event.event_type}</p>
                  <p className="mt-1 text-xs text-[#6f7a74]">
                    Order #{shortId(event.order_id)} · {userMap.get(event.actor_id) || shortId(event.actor_id)} ·{" "}
                    {data.roleLabels[event.actor_role]} · {formatDate(event.created_at)}
                  </p>
                  {Object.keys(event.metadata || {}).length > 0 ? (
                    <pre className="mt-2 max-h-28 overflow-auto whitespace-pre-wrap break-words text-[11px] text-[#6f7a74]">
                      {JSON.stringify(event.metadata, null, 2)}
                    </pre>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>
    );
  }

  const visibleTabs = TABS.filter((item) => item !== "new" || canCreateOrder);

  return (
    <main className="min-h-screen bg-[#DCE6DA] px-4 py-6 text-[#2E3033] sm:px-8">
      <div className="mx-auto max-w-[1500px] space-y-6">
        <header className={`${neu} flex flex-wrap items-center justify-between gap-5 p-5 sm:p-6`}>
          <div className="flex items-center gap-4">
            <Image
              src="/macrobox_primary_cutout.png"
              alt="MacroBox"
              width={190}
              height={70}
              priority
              className="h-auto w-[160px] object-contain sm:w-[190px]"
            />
            <div className="hidden h-10 w-px bg-[#c3cec0] sm:block" />
            <div className="hidden sm:block">
              <p className="font-display text-lg font-bold">POS &amp; Admin</p>
              <p className="text-xs text-[#6f7a74]">Live Supabase · {data.schema}</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <span className="rounded-full bg-[#dcead7] px-3 py-1 text-xs font-bold text-[#4a6c3c]">
              ● LIVE
            </span>
            <div className={`${inset} px-4 py-2 text-right`}>
              <p className="text-sm font-semibold">{data.actor.name}</p>
              <p className="text-xs text-[#6f7a74]">{data.roleLabels[role]}</p>
            </div>
            <Link href="/" className={secondary}>
              Catalog
            </Link>
            <Link href="/orders" className={secondary}>
              My orders
            </Link>
            {role === "DRIVER" || role === "ADMIN" ? (
              <Link href="/driver" className={secondary}>
                Driver view
              </Link>
            ) : null}
            <ActionButton variant="secondary" onClick={handleSignOut} disabled={busy}>
              Sign out
            </ActionButton>
          </div>
        </header>

        <nav className={`${neuSmall} flex gap-1 overflow-x-auto p-2`}>
          {visibleTabs.map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setTab(item)}
              className={`whitespace-nowrap rounded-2xl px-4 py-3 text-sm font-semibold transition ${
                tab === item
                  ? "bg-[#8FBC8F] text-[#223028] shadow-[inset_4px_4px_8px_#7ba47d,inset_-4px_-4px_8px_#a4d4a1]"
                  : "text-[#6f7a74] hover:bg-[#e4ece1]"
              }`}
            >
              {item === "new"
                ? "New order"
                : item.charAt(0).toUpperCase() + item.slice(1)}
            </button>
          ))}
        </nav>

        {message ? (
          <div className="rounded-2xl bg-[#dcead7] px-5 py-4 text-sm font-medium text-[#3f6b45]">
            {message}
          </div>
        ) : null}
        {error ? (
          <div className="rounded-2xl bg-[#f7e2de] px-5 py-4 text-sm font-medium text-[#8a3b2f]">
            {error}
          </div>
        ) : null}

        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: "easeOut" }}
          >
            {tab === "overview"
              ? renderOverview()
              : tab === "orders"
                ? renderOrders()
                : tab === "new"
                  ? renderNewOrder()
                  : tab === "menu"
                    ? renderMenu()
                    : tab === "settings"
                      ? renderSettings()
                      : renderAudit()}
          </motion.div>
        </AnimatePresence>

        <footer className="pb-4 text-center text-xs text-[#7b857f]">
          MacroBox POS · Database-enforced RBAC, state machine, and audit · Generated{" "}
          {formatDate(data.generatedAt)}
        </footer>
      </div>
    </main>
  );
}
