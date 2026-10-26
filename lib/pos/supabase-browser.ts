import { createBrowserClient } from "@supabase/ssr";
import { POS_SCHEMA, SUPABASE_ANON_KEY, SUPABASE_URL } from "./config";

/**
 * Browser client for the login screen. The POS dashboard itself uses Server
 * Actions, but signing in here keeps the Supabase auth cookies in sync.
 */
export function createSupabaseBrowserClient() {
  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error("Supabase URL or anon key is not configured.");
  }

  return createBrowserClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    db: { schema: POS_SCHEMA },
  });
}
