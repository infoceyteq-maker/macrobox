import { CONTACT_LINE } from "@/lib/brand";
import { formatAmount, formatDate, shortId } from "@/components/ui/neu";
import type { DashboardOrder } from "@/lib/pos/dashboard-types";
import type { DecimalValue, DeliverySettingsRow } from "@/lib/pos/types";

interface ThermalReceiptProps {
  order: DashboardOrder;
  kind: "KOT" | "BILL";
  settings?: DeliverySettingsRow;
  foodTotal?: DecimalValue;
  transportCost?: DecimalValue;
  finalTotal?: DecimalValue;
  distanceKm?: number | null;
}

/** 80mm thermal POS output. Hidden on screen; only visible through @media print. */
export default function ThermalReceipt({
  order,
  kind,
  settings,
  foodTotal,
  transportCost,
  finalTotal,
  distanceKm,
}: ThermalReceiptProps) {
  const items = order.order_items ?? [];
  const isKot = kind === "KOT";
  const food = formatAmount(foodTotal ?? order.total_food_cost);
  const transport = formatAmount(transportCost ?? order.transport_cost);
  const total = formatAmount(finalTotal ?? order.final_total);

  return (
    <div className="thermal-print" data-thermal-kind={kind} aria-hidden="true">
      <p className="thermal-title">MACROBOX</p>
      <p className="thermal-center">Lunch (Rice &amp; Curry)</p>
      <p className="thermal-center">{isKot ? "KITCHEN ORDER TICKET" : "CASH ON DELIVERY BILL"}</p>
      <div className="thermal-dashed" />

      <div className="thermal-row">
        <span>Order</span>
        <span>#{shortId(order.id)}</span>
      </div>
      <div className="thermal-row">
        <span>Date</span>
        <span>{formatDate(order.created_at).replace(" UTC", "")}</span>
      </div>
      <div className="thermal-row">
        <span>Status</span>
        <span>{order.status}</span>
      </div>
      <div className="thermal-row">
        <span>Customer</span>
        <span>{order.customer?.name ?? shortId(order.customer_id)}</span>
      </div>
      {order.delivery_address ? (
        <p>Address: {order.delivery_address}</p>
      ) : null}
      {order.delivery_notes ? <p>Notes: {order.delivery_notes}</p> : null}
      <div className="thermal-dashed" />

      <table>
        <thead>
          <tr>
            <th>ITEM</th>
            <th>QTY</th>
            <th>{isKot ? "" : "AMOUNT"}</th>
          </tr>
        </thead>
        <tbody>
          {items.length === 0 ? (
            <tr>
              <td colSpan={3}>No items</td>
            </tr>
          ) : (
            items.map((item) => (
              <tr key={item.id}>
                <td>{item.title_snapshot}</td>
                <td>x{item.quantity}</td>
                <td>{isKot ? "" : formatAmount(item.line_total)}</td>
              </tr>
            ))
          )}
        </tbody>
      </table>
      <div className="thermal-dashed" />

      {isKot ? (
        <>
          <p className="thermal-center">PREPARE FRESH · CHECK GRAMMAGES</p>
          <p className="thermal-center">KOT · NO PRICES</p>
        </>
      ) : (
        <>
          <div className="thermal-row">
            <span>Food subtotal</span>
            <span>{food}</span>
          </div>
          <div className="thermal-row">
            <span>Transport</span>
            <span>{transport}</span>
          </div>
          {distanceKm !== null && distanceKm !== undefined ? (
            <div className="thermal-row">
              <span>Distance</span>
              <span>{formatAmount(distanceKm)} km</span>
            </div>
          ) : null}
          {settings?.per_km_rate != null ? (
            <div className="thermal-row">
              <span>Rate</span>
              <span>{formatAmount(settings.per_km_rate)}/km · {formatAmount(settings.free_distance_km)} free</span>
            </div>
          ) : (
            <p>Rate: not configured</p>
          )}
          <div className="thermal-solid" />
          <div className="thermal-row">
            <strong>FINAL E-BILL</strong>
            <strong>{total}</strong>
          </div>
          <div className="thermal-solid" />
          <div className="thermal-row">
            <span>Payment</span>
            <span>CASH ON DELIVERY</span>
          </div>
          <div className="thermal-row">
            <span>Cash collected</span>
            <span>
              {order.cash_collected_amount === null
                ? "PENDING"
                : formatAmount(order.cash_collected_amount)}
            </span>
          </div>
          <div className="thermal-row">
            <span>Settlement</span>
            <span>{order.cash_settlement_reference || "PENDING"}</span>
          </div>
          <div className="thermal-row">
            <span>Signature</span>
            <span>{order.delivery_signature_url ? "CAPTURED" : "PENDING"}</span>
          </div>
        </>
      )}

      <div className="thermal-dashed" />
      <p className="thermal-center">{CONTACT_LINE}</p>
      <p className="thermal-center">Thank you for choosing MacroBox.</p>
      <div className="thermal-dashed" />
    </div>
  );
}
