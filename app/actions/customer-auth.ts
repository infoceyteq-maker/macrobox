"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { runAction } from "@/lib/pos/action-result";
import { isLocalMode } from "@/lib/pos/config";
import {
  leadOtpRequestSchema,
  leadOtpVerifySchema,
  safeNextPath,
  type CustomerAuthSuccess,
  type CustomerOtpSendResult,
  type LeadProfileDetails,
} from "@/lib/pos/customer-auth";
import {
  applyCustomerLeadDetails,
  ensureCustomerProfileForUser,
} from "@/lib/pos/customer-profile";
import { PosActionError } from "@/lib/pos/errors";
import {
  localSendPhoneOtp,
  localVerifyPhoneOtp,
} from "@/lib/pos/local-db";
import { setLocalSession } from "@/lib/pos/local-session";
import { createSupabaseServerClient } from "@/lib/pos/supabase-server";
import type { ActionResult } from "@/lib/pos/types";

function mapGoogleLinkError(message: string): PosActionError {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("provider is not enabled") ||
    normalized.includes("unsupported provider") ||
    normalized.includes("manual linking is not enabled") ||
    normalized.includes("not enabled")
  ) {
    return new PosActionError(
      "GOOGLE_NOT_CONFIGURED",
      "Google linking is not enabled for MacroBox yet. Choose “Skip & Go to Profile” — your phone sign-in already works.",
    );
  }
  if (normalized.includes("already linked") || normalized.includes("identity is already linked")) {
    return new PosActionError(
      "GOOGLE_ALREADY_LINKED",
      "A Google account is already connected to this profile. Choose “Skip & Go to Profile” to continue.",
    );
  }
  return new PosActionError("GOOGLE_LINK_FAILED", message);
}

/**
 * Optional post-OTP step: link a Google identity to the phone-verified
 * customer. Starts the Supabase OAuth flow and returns the provider URL;
 * `/auth/callback` completes it and re-runs profile provisioning. Requires
 * the Google provider + manual identity linking to be enabled in Supabase
 * Auth (dashboard, with Google Cloud OAuth credentials).
 */
export async function linkCustomerGoogleAction(input: {
  next?: string;
}): Promise<ActionResult<{ url: string }>> {
  return runAction(async () => {
    if (isLocalMode()) {
      throw new PosActionError(
        "GOOGLE_NOT_CONFIGURED",
        "Google linking is not available in the local preview. Choose “Skip & Go to Profile” to continue.",
      );
    }

    const next = safeNextPath(input?.next, "/profile");
    const supabase = await createSupabaseServerClient();
    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      throw new PosActionError(
        "UNAUTHENTICATED",
        "Your session has expired. Please sign in with your phone again.",
      );
    }

    if ((userData.user.identities ?? []).some((identity) => identity.provider === "google")) {
      throw mapGoogleLinkError("Identity is already linked");
    }

    const requestHeaders = await headers();
    const origin =
      requestHeaders.get("origin") ??
      (requestHeaders.get("host") ? `https://${requestHeaders.get("host")}` : null) ??
      process.env.NEXT_PUBLIC_SITE_URL ??
      "";

    if (!origin) {
      throw new PosActionError("GOOGLE_LINK_FAILED", "The site URL is not configured.");
    }

    const { data, error } = await supabase.auth.linkIdentity({
      provider: "google",
      options: {
        redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
        queryParams: { prompt: "select_account" },
      },
    });

    if (error) throw mapGoogleLinkError(error.message);
    if (!data?.url) {
      throw new PosActionError("GOOGLE_LINK_FAILED", "Google did not return a sign-in URL.");
    }

    return { url: data.url };
  });
}

function mapOtpSendError(message: string): PosActionError {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("sms") ||
    normalized.includes("provider") ||
    normalized.includes("unable to send") ||
    normalized.includes("error sending")
  ) {
    return new PosActionError(
      "SMS_PROVIDER_NOT_CONFIGURED",
      "SMS verification is not configured yet. Please contact support or try again later.",
    );
  }
  return new PosActionError("OTP_SEND_FAILED", message);
}

/**
 * Step 1: send a one-time SMS code and create the user on verification.
 * Optional lead details from the registration form travel in Auth user
 * metadata so the auto-created profile can pick up the name and delivery
 * city. The lead email is metadata only — never a verified sign-in email.
 */
export async function sendCustomerPhoneOtpAction(input: {
  phone: string;
  name?: string;
  email?: string;
  location?: string;
}): Promise<ActionResult<CustomerOtpSendResult>> {
  return runAction(async () => {
    const parsed = leadOtpRequestSchema.parse(input);
    const lead: LeadProfileDetails = {
      name: parsed.name || undefined,
      email: parsed.email || undefined,
      location: parsed.location || undefined,
    };

    if (isLocalMode()) {
      return localSendPhoneOtp(parsed.phone, lead);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: parsed.phone,
      options: {
        shouldCreateUser: true,
        channel: "sms",
        data: {
          phone: parsed.phone,
          name: lead.name ?? null,
          full_name: lead.name ?? null,
          lead_email: lead.email ?? null,
          location: lead.location ?? null,
          signup_source: lead.name
            ? "customer_lead_registration"
            : "customer_phone_otp",
        },
      },
    });

    if (error) throw mapOtpSendError(error.message);
    return { phone: parsed.phone, otpSent: true } satisfies CustomerOtpSendResult;
  });
}

/** Step 2: verify the SMS OTP, create the session, and ensure a profile exists. */
export async function verifyCustomerPhoneOtpAction(input: {
  phone: string;
  token: string;
  name?: string;
  email?: string;
  location?: string;
}): Promise<ActionResult<CustomerAuthSuccess>> {
  return runAction(async () => {
    const parsed = leadOtpVerifySchema.parse(input);
    const lead: LeadProfileDetails = {
      name: parsed.name || undefined,
      email: parsed.email || undefined,
      location: parsed.location || undefined,
    };

    if (isLocalMode()) {
      const user = await localVerifyPhoneOtp(parsed.phone, parsed.token, lead);
      await setLocalSession(user.userId);
      revalidatePath("/", "layout");
      return user;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: parsed.phone,
      token: parsed.token,
      type: "sms",
    });

    if (error || !data.user) {
      throw new PosActionError(
        "INVALID_OTP",
        "That verification code is invalid or has expired.",
      );
    }

    await ensureCustomerProfileForUser(data.user);
    // Lead capture is best-effort: the verified session must not fail just
    // because the optional name/city could not be saved (both remain in
    // Auth metadata and can be completed later in My Profile).
    try {
      await applyCustomerLeadDetails(data.user, lead);
    } catch {
      // Intentionally ignored — see note above.
    }
    revalidatePath("/", "layout");

    return {
      userId: data.user.id,
      email: data.user.email ?? "",
      phone: data.user.phone ?? parsed.phone,
    } satisfies CustomerAuthSuccess;
  });
}
