"use client";

import RouteMap from "@/components/tracking/RouteMap";
import { cn, formatAmount, NEU } from "@/components/ui/neu";
import type { OrderStatus } from "@/lib/pos/types";

interface DeliveryMapPlaceholderProps {
  status: OrderStatus;
  address?: string | null;
  distanceKm?: number | null;
  progress?: number;
}

export default function DeliveryMapPlaceholder({
  status,
  address,
  distanceKm,
  progress,
}: DeliveryMapPlaceholderProps) {
  const defaultProgress: Record<OrderStatus, number> = {
    PENDING: 0.05,
    ACCEPTED: 0.18,
    PREPARING: 0.3,
    READY: 0.45,
    DISPATCHED: 0.68,
    DELIVERED: 1,
    CLOSED: 1,
  };

  return (
    <div className="space-y-3">
      <RouteMap
        progress={progress ?? defaultProgress[status]}
        label="Active delivery"
        sublabel={address || "Delivery address pending"}
        badge="Google Maps placeholder"
        compact
        footer="Swap this Soft UI map for Google Maps once NEXT_PUBLIC_GOOGLE_MAPS_API_KEY and a live driver-location feed are supplied."
      />
      {distanceKm !== null && distanceKm !== undefined ? (
        <p className={cn(NEU.insetTiny, "px-3 py-2 text-xs text-[#6f7a74]")}>
          Distance used for dynamic billing:{" "}
          <span className="font-semibold text-[#2E3033]">{formatAmount(distanceKm)} km</span>
        </p>
      ) : null}
    </div>
  );
}
