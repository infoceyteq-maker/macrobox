import "server-only";

import { createClient } from "@supabase/supabase-js";
import { z } from "zod";
import { POS_SCHEMA } from "./config";
import { PosActionError } from "./errors";

const adminEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),
  NEXT_PUBLIC_SUPABASE_SCHEMA: z.string().min(1).default("macrobox_pos"),
});

/**
 * Request-scoped, server-only Supabase admin client. It is used exclusively to
 * provision confirmed customer Auth users and to resolve phone identifiers.
 * The service-role key is never referenced by a client component or prefixed
 * with NEXT_PUBLIC_.
 */
export function createSupabaseAdminClient() {
  const parsed = adminEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    NEXT_PUBLIC_SUPABASE_SCHEMA: process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || POS_SCHEMA,
  });

  if (!parsed.success) {
    throw new PosActionError(
      "SUPABASE_ADMIN_ENV_MISSING",
      "Server-side Supabase configuration is incomplete.",
      parsed.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return createClient(
    parsed.data.NEXT_PUBLIC_SUPABASE_URL,
    parsed.data.SUPABASE_SERVICE_ROLE_KEY,
    {
      db: { schema: parsed.data.NEXT_PUBLIC_SUPABASE_SCHEMA },
      auth: {
        autoRefreshToken: false,
        persistSession: false,
        detectSessionInUrl: false,
      },
    },
  );
}
