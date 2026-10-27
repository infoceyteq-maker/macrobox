import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/pos/supabase-admin";

export const dynamic = "force-dynamic";

/**
 * Non-secret deployment check. It confirms that the server-only service-role
 * key, Supabase Auth Admin API, and the isolated-schema PostgREST profile are
 * all reachable from the Vercel runtime. No account data is returned.
 */
export async function GET() {
  try {
    const admin = createSupabaseAdminClient();
    const [authResult, phoneLookupResult] = await Promise.all([
      admin.auth.admin.listUsers({ page: 1, perPage: 1 }),
      admin.rpc("find_customer_signin_email", { p_phone: "+00000000000" }),
    ]);

    const ok = !authResult.error && !phoneLookupResult.error;
    return NextResponse.json(
      {
        ok,
        supabaseAdminApi: !authResult.error,
        phoneLookupRpc: !phoneLookupResult.error,
        schema: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "macrobox_pos",
        mode: process.env.NEXT_PUBLIC_POS_LIVE_MODE === "local" ? "local" : "supabase",
      },
      { status: ok ? 200 : 503 },
    );
  } catch {
    return NextResponse.json(
      { ok: false, error: "Server-side Supabase configuration is unavailable." },
      { status: 503 },
    );
  }
}
