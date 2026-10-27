"use server";

import { revalidatePath } from "next/cache";
import { getPosEnv } from "@/lib/pos/env";
import { isLocalMode } from "@/lib/pos/config";
import { PosActionError, toActionFailure } from "@/lib/pos/errors";
import { clearLocalSession, setLocalSession } from "@/lib/pos/local-session";
import { localSignIn } from "@/lib/pos/local-db";
import { createSupabaseServerClient } from "@/lib/pos/supabase-server";
import type { ActionResult, AppRole } from "@/lib/pos/types";

export interface AuthSuccess {
  userId: string;
  email: string | null;
  roleHint?: AppRole;
}

const DEMO_ACCOUNTS: Record<AppRole, string> = {
  ADMIN: "admin@macrobox.local",
  MANAGER: "manager@macrobox.local",
  FRONT_DESK: "frontdesk@macrobox.local",
  KITCHEN: "kitchen@macrobox.local",
  DRIVER: "driver@macrobox.local",
  CUSTOMER: "customer@macrobox.local",
};

async function signInWithPassword(
  email: string,
  password: string,
  roleHint?: AppRole,
): Promise<ActionResult<AuthSuccess>> {
  try {
    if (!email.trim() || !password) {
      throw new PosActionError("INVALID_CREDENTIALS", "Email and password are required.");
    }

    if (isLocalMode()) {
      const userId = await localSignIn(email, password);
      await setLocalSession(userId);
      revalidatePath("/", "layout");
      return {
        ok: true,
        data: {
          userId,
          email: email.trim().toLowerCase(),
          ...(roleHint ? { roleHint } : {}),
        },
      };
    }

    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (error || !data.user) {
      throw new PosActionError(
        "SIGN_IN_FAILED",
        error?.message || "Sign-in failed. Check your credentials.",
      );
    }

    revalidatePath("/", "layout");
    return {
      ok: true,
      data: {
        userId: data.user.id,
        email: data.user.email ?? null,
        ...(roleHint ? { roleHint } : {}),
      },
    };
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function signInAction(input: {
  email: string;
  password: string;
}): Promise<ActionResult<AuthSuccess>> {
  return signInWithPassword(input.email, input.password);
}

/**
 * One-click demo sign-in is restricted to the sandboxed PGlite preview. The
 * production deployment never exposes demo buttons or a demo password.
 */
export async function signInDemoAction(
  role: AppRole,
): Promise<ActionResult<AuthSuccess>> {
  try {
    if (!isLocalMode() && process.env.POS_ENABLE_DEMO_SIGNIN !== "true") {
      throw new PosActionError(
        "DEMO_SIGNIN_DISABLED",
        "Demo accounts are disabled in production.",
      );
    }

    const email = DEMO_ACCOUNTS[role];
    if (!email) {
      throw new PosActionError("UNKNOWN_DEMO_ROLE", "Unknown demo role.");
    }

    const password =
      process.env.POS_DEMO_PASSWORD ||
      (isLocalMode() ? "MacroBox@2026!" : getPosEnv().POS_DEMO_PASSWORD);

    if (!password) {
      throw new PosActionError(
        "DEMO_PASSWORD_MISSING",
        "POS_DEMO_PASSWORD is not configured on the server.",
      );
    }

    return await signInWithPassword(email, password, role);
  } catch (error) {
    return toActionFailure(error);
  }
}

export async function signOutAction(): Promise<ActionResult<{ signedOut: true }>> {
  try {
    if (isLocalMode()) {
      await clearLocalSession();
    } else {
      const supabase = await createSupabaseServerClient();
      const { error } = await supabase.auth.signOut();
      if (error) {
        throw new PosActionError("SIGN_OUT_FAILED", error.message);
      }
    }

    revalidatePath("/", "layout");
    return { ok: true, data: { signedOut: true } };
  } catch (error) {
    return toActionFailure(error);
  }
}
