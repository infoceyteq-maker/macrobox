import { NextResponse, type NextRequest } from "next/server";
import { safeNextPath } from "@/lib/pos/customer-auth";
import { ensureCustomerProfileForUser } from "@/lib/pos/customer-profile";
import { createSupabaseServerClient } from "@/lib/pos/supabase-server";

export const dynamic = "force-dynamic";

/** Handles PKCE magic-link codes and token_hash email verification links. */
export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const next = safeNextPath(url.searchParams.get("next"), "/profile");
  const code = url.searchParams.get("code");
  const tokenHash = url.searchParams.get("token_hash");
  const type = url.searchParams.get("type");

  if (!code && !tokenHash) {
    return NextResponse.redirect(new URL("/customer/login?reason=email-link-invalid", url.origin));
  }

  try {
    const supabase = await createSupabaseServerClient();

    if (code) {
      const { error } = await supabase.auth.exchangeCodeForSession(code);
      if (error) throw error;
    } else if (tokenHash && type) {
      const { error } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: type as "email" | "magiclink" | "email_change" | "signup" | "recovery" | "invite",
      });
      if (error) throw error;
    }

    const { data } = await supabase.auth.getUser();
    if (data.user) await ensureCustomerProfileForUser(data.user);

    return NextResponse.redirect(new URL(next, url.origin));
  } catch {
    return NextResponse.redirect(new URL("/customer/login?reason=email-link-failed", url.origin));
  }
}
