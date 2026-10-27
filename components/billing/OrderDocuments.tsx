"use client";

import { useEffect, useMemo, useState } from "react";
import EBill from "@/components/billing/EBill";
import ThermalReceipt from "@/components/billing/ThermalReceipt";
import { cn, NEU, shortId } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import type { DashboardOrder } from "@/lib/pos/dashboard-types";
import type { AppRole, DecimalValue, DeliverySettingsRow } from "@/lib/pos/types";

type PrintKind = "KOT" | "BILL";

interface OrderDocumentsProps {
  orders: DashboardOrder[];
  settings?: DeliverySettingsRow;
  roleLabels?: Record<AppRole, string>;
  schema?: string;
  compact?: boolean;
  initialOrderId?: string;
  foodTotal?: DecimalValue;
  transportCost?: DecimalValue;
  finalTotal?: DecimalValue;
  distanceKm?: number | null;
}

export default function OrderDocuments({
  orders,
  settings,
  roleLabels,
  schema,
  compact = false,
  initialOrderId,
  foodTotal,
  transportCost,
  finalTotal,
  distanceKm,
}: OrderDocumentsProps) {
  const [selectedId, setSelectedId] = useState(initialOrderId ?? orders[0]?.id ?? "");
  const [printKind, setPrintKind] = useState<PrintKind | null>(null);

  useEffect(() => {
    if (!orders.some((order) => order.id === selectedId)) {
      setSelectedId(orders[0]?.id ?? "");
    }
  }, [orders, selectedId]);

  useEffect(() => {
    const reset = () => setPrintKind(null);
    window.addEventListener("afterprint", reset);
    return () => window.removeEventListener("afterprint", reset);
  }, []);

  const order = useMemo(
    () => orders.find((item) => item.id === selectedId) ?? orders[0] ?? null,
    [orders, selectedId],
  );

  function print(kind: PrintKind) {
    if (!order) return;
    setPrintKind(kind);
    notify.info(
      kind === "KOT" ? "Print KOT" : "Print Bill",
      `80mm thermal layout prepared for #${shortId(order.id)}.`,
    );
    window.setTimeout(() => window.print(), 80);
    window.setTimeout(() => setPrintKind(null), 1200);
  }

  if (!order) {
    return (
      <div className={cn(NEU.card, "p-6 text-center text-sm text-[#6f7a74]")}>
        No order selected.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {!compact && orders.length > 1 ? (
        <div className={cn(NEU.cardSmall, "p-3")}>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-widest text-[#6f7a74]">
              Select order
            </span>
            <select
              className={NEU.input}
              value={selectedId}
              onChange={(event) => setSelectedId(event.target.value)}
            >
              {orders.map((item) => (
                <option key={item.id} value={item.id}>
                  #{shortId(item.id)} · {item.status} · {item.customer?.name ?? "Customer"}
                </option>
              ))}
            </select>
          </label>
        </div>
      ) : null}

      <div className="no-print flex flex-wrap gap-2">
        <button type="button" onClick={() => print("KOT")} className={cn(NEU.button, "flex-1")}>
          Print KOT
        </button>
        <button type="button" onClick={() => print("BILL")} className={cn(NEU.buttonPrimary, "flex-1")}>
          Print Bill
        </button>
      </div>

      <EBill
        order={order}
        settings={settings}
        roleLabels={roleLabels}
        schema={schema}
        compact={compact}
        foodTotal={foodTotal}
        transportCost={transportCost}
        finalTotal={finalTotal}
        distanceKm={distanceKm}
      />

      {printKind ? (
        <ThermalReceipt
          order={order}
          kind={printKind}
          settings={settings}
          foodTotal={foodTotal}
          transportCost={transportCost}
          finalTotal={finalTotal}
          distanceKm={distanceKm}
        />
      ) : null}
    </div>
  );
}
