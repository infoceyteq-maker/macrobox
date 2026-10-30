"use server";

import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { runAction } from "@/lib/pos/action-result";
import { isLocalMode } from "@/lib/pos/config";
import {
  CUSTOMER_WHATSAPP_CHANNEL,
  emailOtpRequestSchema,
  emailOtpVerifySchema,
  leadOtpRequestSchema,
  leadOtpVerifySchema,
  safeNextPath,
  whatsappOtpRequestSchema,
  whatsappOtpVerifySchema,
  type CustomerAuthSuccess,
  type CustomerOtpSendResult,
  type EmailOtpSendResult,
  type LeadProfileDetails,
  type WhatsappOtpRequestInput,
  type WhatsappOtpVerifyInput,
} from "@/lib/pos/customer-auth";
import {
  applyCustomerLeadDetails,
  ensureCustomerProfileForUser,
} from "@/lib/pos/customer-profile";
import { PosActionError } from "@/lib/pos/errors";
import {
  localSendEmailOtp,
  localSendPhoneOtp,
  localVerifyEmailOtp,
  localVerifyPhoneOtp,
} from "@/lib/pos/local-db";
import { setLocalSession } from "@/lib/pos/local-session";
import { createSupabaseAdminClient } from "@/lib/pos/supabase-admin";
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

async function requestOrigin(): Promise<string> {
  const requestHeaders = await headers();
  return (
    requestHeaders.get("origin") ??
    (requestHeaders.get("host") ? `https://${requestHeaders.get("host")}` : null) ??
    process.env.NEXT_PUBLIC_SITE_URL ??
    ""
  );
}

/**
 * Alternative customer sign-in step 1: send an email OTP code. The same
 * email also contains a magic link via /auth/callback; customers may use
 * either. Creates the account on verification (shouldCreateUser).
 */
export async function sendCustomerEmailOtpAction(input: {
  email: string;
}): Promise<ActionResult<EmailOtpSendResult>> {
  return runAction(async () => {
    const { email } = emailOtpRequestSchema.parse(input);

    if (isLocalMode()) {
      return localSendEmailOtp(email);
    }

    const origin = await requestOrigin();
    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: {
        shouldCreateUser: true,
        emailRedirectTo: origin
          ? `${origin}/auth/callback?next=${encodeURIComponent("/profile")}`
          : undefined,
        data: { signup_source: "customer_email_otp" },
      },
    });

    if (error) {
      throw new PosActionError(
        "OTP_SEND_FAILED",
        "We could not send the email code. Please check the address and try again.",
      );
    }
    return { email, otpSent: true } satisfies EmailOtpSendResult;
  });
}

/**
 * Alternative customer sign-in step 2: verify the email OTP, create the
 * session, and ensure a customer profile exists. Staff emails are rejected
 * here so employee accounts can never enter through the customer surface.
 */
export async function verifyCustomerEmailOtpAction(input: {
  email: string;
  token: string;
}): Promise<ActionResult<CustomerAuthSuccess>> {
  return runAction(async () => {
    const parsed = emailOtpVerifySchema.parse(input);

    if (isLocalMode()) {
      const user = await localVerifyEmailOtp(parsed.email, parsed.token);
      await setLocalSession(user.userId);
      revalidatePath("/", "layout");
      return user;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      email: parsed.email,
      token: parsed.token,
      type: "email",
    });

    if (error || !data.user) {
      throw new PosActionError(
        "INVALID_OTP",
        "That verification code is invalid or has expired.",
      );
    }

    await ensureCustomerProfileForUser(data.user);

    // The auth trigger must never downgrade a staff role, so guard the
    // customer surface explicitly instead of landing staff in My Profile.
    const admin = createSupabaseAdminClient();
    const { data: profile } = await admin
      .from("app_users")
      .select("role")
      .eq("id", data.user.id)
      .maybeSingle();
    if (profile && profile.role !== "CUSTOMER") {
      await supabase.auth.signOut();
      throw new PosActionError(
        "STAFF_EMAIL",
        "This email belongs to a staff account. Please use the employee sign-in instead.",
      );
    }

    revalidatePath("/", "layout");

    return {
      userId: data.user.id,
      email: data.user.email ?? parsed.email,
      phone: data.user.phone ?? null,
    } satisfies CustomerAuthSuccess;
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

function mapWhatsAppOtpSendError(message: string): PosActionError {
  const normalized = message.toLowerCase();
  if (
    normalized.includes("whatsapp") ||
    normalized.includes("twilio") ||
    normalized.includes("provider") ||
    normalized.includes("sms") ||
    normalized.includes("unable to send") ||
    normalized.includes("error sending") ||
    normalized.includes("channel")
  ) {
    return new PosActionError(
      "WHATSAPP_PROVIDER_NOT_CONFIGURED",
      "WhatsApp verification is not configured yet. Please add the WhatsApp sender in Supabase Auth and try again.",
    );
  }
  return new PosActionError("WHATSAPP_OTP_SEND_FAILED", message);
}

async function assertCustomerRole(
  userId: string,
  supabase: Awaited<ReturnType<typeof createSupabaseServerClient>>,
): Promise<void> {
  const admin = createSupabaseAdminClient();
  const { data: profile } = await admin
    .from("app_users")
    .select("role")
    .eq("id", userId)
    .maybeSingle();

  if (profile && profile.role !== "CUSTOMER") {
    await supabase.auth.signOut();
    throw new PosActionError(
      "STAFF_ACCOUNT",
      "This number belongs to an internal account. Please use the direct staff portal sign-in instead.",
    );
  }
}

/**
 * Baduma.sl customer step 1: ask Supabase Auth to deliver a 6-digit OTP to
 * the customer's WhatsApp number. Supabase creates the Auth user when OTP
 * verification succeeds; no password or upfront profile form is collected.
 */
export async function sendCustomerWhatsAppOtpAction(
  input: WhatsappOtpRequestInput,
): Promise<ActionResult<CustomerOtpSendResult>> {
  return runAction(async () => {
    const parsed = whatsappOtpRequestSchema.parse(input);

    if (isLocalMode()) {
      return localSendPhoneOtp(parsed.phone, {
        location: undefined,
      });
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone: parsed.phone,
      options: {
        shouldCreateUser: true,
        channel: CUSTOMER_WHATSAPP_CHANNEL,
        data: {
          phone: parsed.phone,
          signup_source: "customer_whatsapp_otp",
          otp_channel: CUSTOMER_WHATSAPP_CHANNEL,
        },
      },
    });

    if (error) throw mapWhatsAppOtpSendError(error.message);
    return { phone: parsed.phone, otpSent: true } satisfies CustomerOtpSendResult;
  });
}

/**
 * Baduma.sl customer step 2: verify the WhatsApp OTP, establish the Supabase
 * session, auto-create/repair the base customer profile, and let the UI send
 * the customer straight to My Profile to complete name/address later.
 */
export async function verifyCustomerWhatsAppOtpAction(
  input: WhatsappOtpVerifyInput,
): Promise<ActionResult<CustomerAuthSuccess>> {
  return runAction(async () => {
    const parsed = whatsappOtpVerifySchema.parse(input);

    if (isLocalMode()) {
      const user = await localVerifyPhoneOtp(parsed.phone, parsed.token);
      await setLocalSession(user.userId);
      revalidatePath("/", "layout");
      return user;
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.verifyOtp({
      phone: parsed.phone,
      token: parsed.token,
      // Supabase verifies phone OTPs with the `sms` type even when the code
      // was delivered through the WhatsApp channel.
      type: "sms",
    });

    if (error || !data.user) {
      throw new PosActionError(
        "INVALID_WHATSAPP_OTP",
        "That WhatsApp code is invalid or has expired. Please request a new code.",
      );
    }

    await ensureCustomerProfileForUser(data.user);
    await assertCustomerRole(data.user.id, supabase);
    revalidatePath("/", "layout");

    return {
      userId: data.user.id,
      email: data.user.email ?? "",
      phone: data.user.phone ?? parsed.phone,
    } satisfies CustomerAuthSuccess;
  });
}
