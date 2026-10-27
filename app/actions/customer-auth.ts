"use server";

import { revalidatePath } from "next/cache";
import { runAction } from "@/lib/pos/action-result";
import { isLocalMode, POS_SCHEMA } from "@/lib/pos/config";
import {
  customerRegistrationSchema,
  customerSignInSchema,
  isEmailIdentifier,
  normalizeIdentifier,
  type CustomerAuthSuccess,
} from "@/lib/pos/customer-auth";
import { PosActionError } from "@/lib/pos/errors";
import {
  localCustomerSignIn,
  localRegisterCustomer,
} from "@/lib/pos/local-db";
import { setLocalSession } from "@/lib/pos/local-session";
import { createSupabaseAdminClient } from "@/lib/pos/supabase-admin";
import { createSupabaseServerClient } from "@/lib/pos/supabase-server";
import type { ActionResult } from "@/lib/pos/types";

type AdminUserAttributes = Parameters<
  ReturnType<typeof createSupabaseAdminClient>["auth"]["admin"]["createUser"]
>[0];

function friendlyProvisioningError(message: string): PosActionError {
  const normalized = message.toLowerCase();
  if (normalized.includes("email") && normalized.includes("registered")) {
    return new PosActionError(
      "EMAIL_ALREADY_REGISTERED",
      "That email is already registered. Sign in instead.",
    );
  }
  if (normalized.includes("phone") && normalized.includes("registered")) {
    return new PosActionError(
      "PHONE_ALREADY_REGISTERED",
      "That phone number is already registered. Sign in instead.",
    );
  }
  return new PosActionError("CUSTOMER_SIGNUP_FAILED", message);
}

/** Public customer registration. Requires both email and E.164 phone. */
export async function registerCustomerAction(input: {
  name: string;
  email: string;
  phone: string;
  password: string;
}): Promise<ActionResult<CustomerAuthSuccess>> {
  return runAction(async () => {
    const parsed = customerRegistrationSchema.parse(input);

    if (isLocalMode()) {
      const user = await localRegisterCustomer(parsed);
      await setLocalSession(user.userId);
      revalidatePath("/", "layout");
      return user;
    }

    const admin = createSupabaseAdminClient();

    const { data: existingEmail, error: emailLookupError } = await admin.rpc(
      "find_customer_signin_email",
      { p_phone: parsed.phone },
    );
    if (emailLookupError) {
      throw new PosActionError("PHONE_LOOKUP_FAILED", emailLookupError.message);
    }
    if (existingEmail) {
      throw new PosActionError(
        "PHONE_ALREADY_REGISTERED",
        "That phone number is already registered. Sign in instead.",
      );
    }

    const attributes: AdminUserAttributes = {
      email: parsed.email,
      phone: parsed.phone,
      password: parsed.password,
      email_confirm: true,
      phone_confirm: true,
      user_metadata: {
        name: parsed.name,
        phone: parsed.phone,
        signup_source: "customer_ui",
      },
      app_metadata: {
        provider: "email",
        providers: ["email", "phone"],
      },
    };

    const { data: created, error: createError } =
      await admin.auth.admin.createUser(attributes);
    if (createError || !created.user) {
      throw friendlyProvisioningError(
        createError?.message || "Unable to create the customer account.",
      );
    }

    // The Auth trigger creates the CUSTOMER profile. This update is an explicit
    // idempotent guard for projects where the trigger was applied earlier.
    const { error: profileError } = await admin
      .schema(POS_SCHEMA)
      .from("app_users")
      .update({
        role: "CUSTOMER",
        status: "ACTIVE",
        name: parsed.name,
        email: parsed.email,
        phone: parsed.phone,
      })
      .eq("id", created.user.id);

    if (profileError) {
      await admin.auth.admin.deleteUser(created.user.id);
      throw new PosActionError("PROFILE_PROVISIONING_FAILED", profileError.message);
    }

    const supabase = await createSupabaseServerClient();
    const { data: sessionData, error: signInError } =
      await supabase.auth.signInWithPassword({
        email: parsed.email,
        password: parsed.password,
      });

    if (signInError || !sessionData.user) {
      throw new PosActionError(
        "POST_SIGNUP_SIGNIN_FAILED",
        "Your account was created. Please sign in with your email or phone.",
      );
    }

    revalidatePath("/", "layout");
    return {
      userId: sessionData.user.id,
      email: parsed.email,
      phone: parsed.phone,
    } satisfies CustomerAuthSuccess;
  });
}

/** Customer sign-in accepts either the registered email or phone number. */
export async function signInCustomerAction(input: {
  identifier: string;
  password: string;
}): Promise<ActionResult<CustomerAuthSuccess>> {
  return runAction(async () => {
    const parsed = customerSignInSchema.parse(input);
    const identifier = normalizeIdentifier(parsed.identifier);

    if (isLocalMode()) {
      const user = await localCustomerSignIn(identifier, parsed.password);
      await setLocalSession(user.userId);
      revalidatePath("/", "layout");
      return user;
    }

    const supabase = await createSupabaseServerClient();
    const isEmail = isEmailIdentifier(identifier);

    let result = await supabase.auth.signInWithPassword(
      isEmail
        ? { email: identifier, password: parsed.password }
        : { phone: identifier, password: parsed.password },
    );

    // Some Supabase projects disable direct phone/password sign-in even when a
    // confirmed phone identity exists. Resolve it to the Auth email server-side.
    if ((result.error || !result.data.user) && !isEmail) {
      const admin = createSupabaseAdminClient();
      const { data: email, error: lookupError } = await admin.rpc(
        "find_customer_signin_email",
        { p_phone: identifier },
      );
      if (lookupError) {
        throw new PosActionError("PHONE_LOOKUP_FAILED", lookupError.message);
      }
      if (typeof email === "string" && email) {
        result = await supabase.auth.signInWithPassword({
          email,
          password: parsed.password,
        });
      }
    }

    if (result.error || !result.data.user) {
      throw new PosActionError(
        "INVALID_CREDENTIALS",
        "Invalid email/phone or password.",
      );
    }

    revalidatePath("/", "layout");
    return {
      userId: result.data.user.id,
      email: result.data.user.email ?? "",
      phone: result.data.user.phone ?? null,
    } satisfies CustomerAuthSuccess;
  });
}
