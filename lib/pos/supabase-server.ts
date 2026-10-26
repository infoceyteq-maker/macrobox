import "server-only";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import { getPosEnv } from "./env";
import { PosActionError } from "./errors";

/**
 * Creates a request-scoped Supabase client using the signed-in user's cookies.
 * RPCs therefore execute with auth.uid(), and the database — not the client —
 * is the final authority for roles, transitions, and money.
 */
export async function createSupabaseServerClient(): Promise<SupabaseClient> {
  const env = getPosEnv();
  const cookieStore = await cookies();

  return createServerClient(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set({ name, value, ...options });
            });
          } catch {
            // Server Actions can refresh cookies; middleware may own writes in
            // some deployments. The RPC still uses the incoming access token.
          }
        },
      },
    },
  );
}

export async function requirePosSession(): Promise<{
  supabase: SupabaseClient;
  user: User;
}> {
  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.getUser();

  if (error || !data.user) {
    throw new PosActionError("UNAUTHENTICATED", "You must be signed in.");
  }

  return { supabase, user: data.user };
}
