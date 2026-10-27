"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { runAction } from "@/lib/pos/action-result";
import { isLocalMode } from "@/lib/pos/config";
import { customerProfileSchema, emailLinkSchema } from "@/lib/pos/customer-auth";
import { PosActionError, normalizeDatabaseError } from "@/lib/pos/errors";
import {
  localLinkCustomerEmail,
  localUpdateCustomerProfile,
} from "@/lib/pos/local-db";
import { requireLocalUserId } from "@/lib/pos/local-session";
import { requirePosSession } from "@/lib/pos/supabase-server";
import type { ActionResult, AppUserRow } from "@/lib/pos/types";

/** Customer-owned profile update. Role and status are never accepted from UI. */
export async function updateCustomerProfileAction(input: {
  name?: string;
  deliveryAddress?: string;
  deliveryNotes?: string;
}): Promise<ActionResult<AppUserRow>> {
  return runAction(async () => {
    const parsed = customerProfileSchema.parse(input);

    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      const profile = await localUpdateCustomerProfile(userId, parsed);
      revalidatePath("/profile");
      return profile;
    }

    const { supabase } = await requirePosSession();
    const { data, error } = await supabase.rpc("update_customer_profile", {
      p_name: parsed.name,
      p_delivery_address: parsed.deliveryAddress,
      p_delivery_notes: parsed.deliveryNotes,
    });

    if (error) throw normalizeDatabaseError(error);
    if (!data) throw new PosActionError("PROFILE_UPDATE_FAILED", "The profile could not be saved.");
    revalidatePath("/profile");
    return data as AppUserRow;
  });
}

/**
 * Optional step: attach/verify an email by sending a Supabase magic link.
 * The callback route syncs the confirmed email back into app_users.
 */
export async function sendCustomerEmailLinkAction(input: {
  email: string;
}): Promise<ActionResult<{ email: string }>> {
  return runAction(async () => {
    const { email } = emailLinkSchema.parse(input);

    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      await localLinkCustomerEmail(userId, email);
      revalidatePath("/profile");
      return { email };
    }

    const { supabase } = await requirePosSession();
    const requestHeaders = await headers();
    const origin =
      requestHeaders.get("origin") ??
      (requestHeaders.get("host") ? `https://${requestHeaders.get("host")}` : null) ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "";

    if (!origin) {
      throw new PosActionError("EMAIL_LINK_FAILED", "The site URL is not configured.");
    }

    const { error } = await supabase.auth.updateUser(
      { email },
      { emailRedirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/profile")}` },
    );

    if (error) {
      throw new PosActionError("EMAIL_LINK_FAILED", "We could not send the email verification link.");
    }

    revalidatePath("/profile");
    return { email };
  });
}
