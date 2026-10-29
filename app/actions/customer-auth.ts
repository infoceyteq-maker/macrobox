"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/pos/action-result";
import { isLocalMode } from "@/lib/pos/config";
import {
  leadOtpRequestSchema,
  leadOtpVerifySchema,
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
