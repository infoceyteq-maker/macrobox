import "server-only";

import type { User } from "@supabase/supabase-js";
import { authPhoneToE164, normalizePhone } from "./customer-auth";
import { normalizeDatabaseError } from "./errors";
import { createSupabaseAdminClient } from "./supabase-admin";

/**
 * Prefer the E.164 phone saved in user_metadata by our OTP request. GoTrue
 * stores auth.users.phone without the leading plus, so fall back to that.
 */
export function phoneFromAuthUser(user: User): string | null {
  const metadataPhone = user.user_metadata?.phone;
  if (typeof metadataPhone === "string" && metadataPhone.trim()) {
    const normalized = normalizePhone(metadataPhone);
    if (/^\+[1-9]\d{7,14}$/.test(normalized)) return normalized;
  }
  return authPhoneToE164(user.phone);
}

function metadataString(user: User, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = user.user_metadata?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/** Lead details captured at registration and stored in Auth user metadata. */
export function leadDetailsFromAuthUser(user: User): {
  name: string | null;
  location: string | null;
} {
  return {
    name: metadataString(user, "name", "full_name"),
    location: metadataString(user, "location", "delivery_location", "delivery_city"),
  };
}

export function displayNameFromAuthUser(user: User): string {
  const metadataName = metadataString(user, "name", "full_name");
  if (metadataName) {
    return metadataName.slice(0, 160);
  }
  const phone = phoneFromAuthUser(user);
  if (phone) return `Customer ${phone.slice(-4)}`;
  const emailLocalPart = user.email?.split("@")[0]?.trim();
  return emailLocalPart ? emailLocalPart.slice(0, 160) : "MacroBox Customer";
}

/**
 * Idempotent profile creation after phone OTP verification or email-link
 * callback. Uses the service-role RPC so a brand-new user can be provisioned
 * before their first authenticated query.
 */
export async function ensureCustomerProfileForUser(user: User): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { error } = await admin.rpc("ensure_customer_profile", {
    p_user_id: user.id,
    p_email: user.email ?? null,
    p_phone: phoneFromAuthUser(user),
    p_name: displayNameFromAuthUser(user),
  });

  if (error) throw normalizeDatabaseError(error);
}

const PLACEHOLDER_NAMES = new Set(["New user", "MacroBox Customer"]);

/**
 * Best-effort lead-detail capture after OTP verification. The name typed on
 * the registration form is applied, and the delivery city only fills an
 * empty delivery address so it can never overwrite a fuller address the
 * customer later saved in My Profile. The unverified lead email is kept in
 * Auth metadata only and is deliberately not copied into the profile email:
 * profile email is reserved for the verified magic-link flow.
 */
export async function applyCustomerLeadDetails(
  user: User,
  explicit?: { name?: string; location?: string },
): Promise<void> {
  const fromMetadata = leadDetailsFromAuthUser(user);
  const name = (explicit?.name?.trim() || fromMetadata.name || "").slice(0, 160);
  const location = (explicit?.location?.trim() || fromMetadata.location || "").slice(0, 160);
  if (!name && !location) return;

  const admin = createSupabaseAdminClient();
  const { data: current, error: readError } = await admin
    .from("app_users")
    .select("name, delivery_address")
    .eq("id", user.id)
    .maybeSingle();
  if (readError) throw normalizeDatabaseError(readError);
  if (!current) return;

  const update: { name?: string; delivery_address?: string } = {};
  const currentName = typeof current.name === "string" ? current.name : "";
  if (
    name &&
    currentName !== name &&
    (PLACEHOLDER_NAMES.has(currentName) || /^Customer \d{4}$/.test(currentName))
  ) {
    update.name = name;
  }
  if (location && !current.delivery_address) {
    update.delivery_address = location;
  }
  if (Object.keys(update).length === 0) return;

  const { error } = await admin.from("app_users").update(update).eq("id", user.id);
  if (error) throw normalizeDatabaseError(error);
}
