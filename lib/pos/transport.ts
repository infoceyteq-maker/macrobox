import type { DecimalValue, DeliverySettingsRow } from "./types";

/**
 * Approved MacroBox distance-based transport billing.
 *
 * Currency: LKR. This is the exact business rule supplied for production:
 *
 *   Tier 1 — 0 to 3 km (inclusive):             flat LKR 150
 *   Tier 2 — >3 km to 4 km (inclusive):          + LKR 120  => LKR 270
 *   Tier 3 — >4 km to 5 km (inclusive):          + LKR 100  => LKR 370
 *   Tier 4 — >5 km:                              + LKR 60 per additional km
 *
 * Tier 2 and Tier 3 are flat step charges for entering that kilometre band,
 * not proportional charges. Tier 4 is proportional for every km after 5 km.
 * The PostgreSQL function of the same name is authoritative when an order is
 * marked DELIVERED; this TypeScript implementation mirrors it for live UI
 * previews and tests.
 */
export interface TransportTierConfig {
  currency: string;
  baseDistanceKm: number;
  fourthKmCeilingKm: number;
  fifthKmCeilingKm: number;
  baseRate: number;
  fourthKmRate: number;
  fifthKmRate: number;
  beyondRatePerKm: number;
  isConfigured: boolean;
}

export const APPROVED_TRANSPORT_TIERS: TransportTierConfig = {
  currency: "LKR",
  baseDistanceKm: 3,
  fourthKmCeilingKm: 4,
  fifthKmCeilingKm: 5,
  baseRate: 150,
  fourthKmRate: 120,
  fifthKmRate: 100,
  beyondRatePerKm: 60,
  isConfigured: true,
};

export const TRANSPORT_FORMULA =
  "0–3 km = LKR 150; >3–4 km = LKR 270; >4–5 km = LKR 370; >5 km = LKR 370 + (distanceKm − 5) × LKR 60";

export const TRANSPORT_TIER_LABELS = [
  "0–3 km: LKR 150 flat",
  "4th km: +LKR 120 (total LKR 270)",
  "5th km: +LKR 100 (total LKR 370)",
  "Beyond 5 km: +LKR 60 per additional km",
] as const;

function toNumber(value: DecimalValue | number | string | null | undefined, fallback: number) {
  if (value === null || value === undefined || value === "") return fallback;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function roundCurrency(value: number): number {
  return Math.round((value + Number.EPSILON) * 100) / 100;
}

/**
 * Exact tiered transport calculation. `distanceInKm` may be fractional.
 * The result is rounded to 2 decimal places, matching numeric(12,2) in SQL.
 */
export function calculateTransportCost(
  distanceInKm: number,
  config: TransportTierConfig = APPROVED_TRANSPORT_TIERS,
): number {
  if (!Number.isFinite(distanceInKm) || distanceInKm < 0) {
    throw new RangeError("distanceInKm must be a non-negative finite number");
  }
  if (!config.isConfigured) {
    throw new Error("TRANSPORT_RATE_NOT_CONFIGURED");
  }

  const {
    baseDistanceKm,
    fourthKmCeilingKm,
    fifthKmCeilingKm,
    baseRate,
    fourthKmRate,
    fifthKmRate,
    beyondRatePerKm,
  } = config;

  if (distanceInKm <= baseDistanceKm) {
    return roundCurrency(baseRate);
  }
  if (distanceInKm <= fourthKmCeilingKm) {
    return roundCurrency(baseRate + fourthKmRate);
  }
  if (distanceInKm <= fifthKmCeilingKm) {
    return roundCurrency(baseRate + fourthKmRate + fifthKmRate);
  }

  return roundCurrency(
    baseRate +
      fourthKmRate +
      fifthKmRate +
      (distanceInKm - fifthKmCeilingKm) * beyondRatePerKm,
  );
}

/** Returns the configured tier values from a live delivery_settings row. */
export function getTransportTierConfig(
  settings?: DeliverySettingsRow | null,
): TransportTierConfig {
  if (!settings) return APPROVED_TRANSPORT_TIERS;

  return {
    currency: settings.currency_code || APPROVED_TRANSPORT_TIERS.currency,
    baseDistanceKm: toNumber(
      settings.base_distance_km,
      APPROVED_TRANSPORT_TIERS.baseDistanceKm,
    ),
    fourthKmCeilingKm: toNumber(
      settings.fourth_km_ceiling_km,
      APPROVED_TRANSPORT_TIERS.fourthKmCeilingKm,
    ),
    fifthKmCeilingKm: toNumber(
      settings.fifth_km_ceiling_km,
      APPROVED_TRANSPORT_TIERS.fifthKmCeilingKm,
    ),
    baseRate: toNumber(settings.base_rate, APPROVED_TRANSPORT_TIERS.baseRate),
    fourthKmRate: toNumber(
      settings.fourth_km_rate,
      APPROVED_TRANSPORT_TIERS.fourthKmRate,
    ),
    fifthKmRate: toNumber(settings.fifth_km_rate, APPROVED_TRANSPORT_TIERS.fifthKmRate),
    beyondRatePerKm: toNumber(
      settings.beyond_rate_per_km,
      APPROVED_TRANSPORT_TIERS.beyondRatePerKm,
    ),
    isConfigured: isTransportConfigured(settings),
  };
}

/** True only when the singleton settings row has been activated by Admin. */
export function isTransportConfigured(
  settings?: DeliverySettingsRow | null,
): boolean {
  if (!settings) return false;
  if (settings.is_configured === false) return false;
  if (settings.rate_model && settings.rate_model !== "TIERED_LKR") return false;
  return settings.per_km_rate !== null && settings.per_km_rate !== undefined;
}

export function formatTransportTierSummary(config = APPROVED_TRANSPORT_TIERS): string {
  return `${config.currency} ${config.baseRate.toFixed(2)} up to ${config.baseDistanceKm} km · ` +
    `+${config.fourthKmRate.toFixed(2)} at ${config.fourthKmCeilingKm} km · ` +
    `+${config.fifthKmRate.toFixed(2)} at ${config.fifthKmCeilingKm} km · ` +
    `+${config.beyondRatePerKm.toFixed(2)}/km after ${config.fifthKmCeilingKm} km`;
}
