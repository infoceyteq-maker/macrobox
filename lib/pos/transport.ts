/**
 * Pure estimator that mirrors public.calculate_transport_cost(). It is useful
 * for server-side previews only; the database function is authoritative and is
 * applied to the order only at delivery.
 *
 * No default rate is hardcoded. Admin must configure it through
 * setTransportRateAction / public.set_transport_rate().
 */
export function calculateTransportCost(options: {
  distanceKm: number;
  perKmRate: number;
  freeDistanceKm?: number;
}): number {
  const { distanceKm, perKmRate } = options;
  const freeDistanceKm = options.freeDistanceKm ?? 2;

  if (!Number.isFinite(distanceKm) || distanceKm < 0) {
    throw new RangeError("distanceKm must be a non-negative finite number");
  }

  if (!Number.isFinite(perKmRate) || perKmRate < 0) {
    throw new RangeError("perKmRate must be a non-negative finite number");
  }

  if (!Number.isFinite(freeDistanceKm) || freeDistanceKm < 0) {
    throw new RangeError("freeDistanceKm must be a non-negative finite number");
  }

  const billableKm = Math.max(distanceKm - freeDistanceKm, 0);
  return Math.round(billableKm * perKmRate * 100) / 100;
}

/**
 * Example: distance 5km with a configured rate of 120 and 2 free km yields
 * (5 - 2) * 120. This is documentation only; no rate value is seeded.
 */
export const TRANSPORT_FORMULA = "max(distanceKm - freeDistanceKm, 0) * perKmRate";
