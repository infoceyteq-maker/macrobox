import "server-only";
import { z } from "zod";
import { PosActionError } from "./errors";
import { POS_SCHEMA } from "./config";

const posEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url().optional(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1).optional(),
  NEXT_PUBLIC_SUPABASE_SCHEMA: z.string().min(1).default("macrobox_pos"),
  POS_DEMO_PASSWORD: z.string().min(1).optional(),
});

export type PosEnv = z.infer<typeof posEnvSchema>;

/** Parsed lazily so `next build` does not require runtime secrets. */
export function getPosEnv(): PosEnv {
  const result = posEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL || undefined,
    NEXT_PUBLIC_SUPABASE_ANON_KEY:
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || undefined,
    NEXT_PUBLIC_SUPABASE_SCHEMA:
      process.env.NEXT_PUBLIC_SUPABASE_SCHEMA || POS_SCHEMA,
    POS_DEMO_PASSWORD: process.env.POS_DEMO_PASSWORD || undefined,
  });

  if (!result.success) {
    throw new PosActionError(
      "SUPABASE_ENV_MISSING",
      "Supabase environment configuration is invalid.",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return result.data;
}
