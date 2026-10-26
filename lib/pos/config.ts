/** Public, browser-safe POS configuration. */
export const POS_SCHEMA =
  process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || "macrobox_pos";

export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
export const SUPABASE_ANON_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "";

/**
 * `local` runs the same SQL migration inside PGlite for sandboxed previews.
 * `supabase` uses the connected Supabase project through @supabase/ssr.
 */
export const POS_LIVE_MODE =
  process.env.NEXT_PUBLIC_POS_LIVE_MODE === "local" ? "local" : "supabase";

export const isLocalMode = () => POS_LIVE_MODE === "local";

/** Cookie used only by the local PGlite live mode. */
export const LOCAL_SESSION_COOKIE = "macrobox_pos_user";
