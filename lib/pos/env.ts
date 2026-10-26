import "server-only";
import { z } from "zod";
import { PosActionError } from "./errors";

const posEnvSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
});

export type PosEnv = z.infer<typeof posEnvSchema>;

/** Parsed lazily so `next build` does not require runtime secrets. */
export function getPosEnv(): PosEnv {
  const result = posEnvSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  });

  if (!result.success) {
    throw new PosActionError(
      "SUPABASE_ENV_MISSING",
      "Supabase URL or anon key is not configured.",
      result.error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    );
  }

  return result.data;
}
