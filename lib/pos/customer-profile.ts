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

export function displayNameFromAuthUser(user: User): string {
  const metadataName = user.user_metadata?.name;
  if (typeof metadataName === "string" && metadataName.trim()) {
    return metadataName.trim().slice(0, 160);
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
