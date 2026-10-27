"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/pos/action-result";
import { isLocalMode } from "@/lib/pos/config";
import {
  phoneOtpRequestSchema,
  phoneOtpVerifySchema,
  type CustomerAuthSuccess,
  type CustomerOtpSendResult,
} from "@/lib/pos/customer-auth";
import { ensureCustomerProfileForUser } from "@/lib/pos/customer-profile";
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

/** Step 1: send a one-time SMS code and create the user on verification. */
export async function sendCustomerPhoneOtpAction(input: {
  phone: string;
}): Promise<ActionResult<CustomerOtpSendResult>> {
  return runAction(async () => {
    const { phone } = phoneOtpRequestSchema.parse(input);

    if (isLocalMode()) {
      return localSendPhoneOtp(phone);
    }

    const supabase = await createSupabaseServerClient();
    const { error } = await supabase.auth.signInWithOtp({
      phone,
      options: {
        shouldCreateUser: true,
        channel: "sms",
        data: {
          phone,
          signup_source: "customer_phone_otp",
        },
      },
    });

    if (error) throw mapOtpSendError(error.message);
    return { phone, otpSent: true } satisfies CustomerOtpSendResult;
  });
}

/** Step 2: verify the SMS OTP, create the session, and ensure a profile exists. */
export async function verifyCustomerPhoneOtpAction(input: {
  phone: string;
  token: string;
}): Promise<ActionResult<CustomerAuthSuccess>> {
  return runAction(async () => {
    const parsed = phoneOtpVerifySchema.parse(input);

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
      type: "sms",
    });

    if (error || !data.user) {
      throw new PosActionError(
        "INVALID_OTP",
        "That verification code is invalid or has expired.",
      );
    }

    await ensureCustomerProfileForUser(data.user);
    revalidatePath("/", "layout");

    return {
      userId: data.user.id,
      email: data.user.email ?? "",
      phone: data.user.phone ?? parsed.phone,
    } satisfies CustomerAuthSuccess;
  });
}
