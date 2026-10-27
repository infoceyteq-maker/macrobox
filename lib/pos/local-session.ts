import "server-only";
import { cookies } from "next/headers";
import { LOCAL_SESSION_COOKIE } from "./config";
import { PosActionError } from "./errors";

const COOKIE_OPTIONS = {
  httpOnly: true,
  sameSite: "lax" as const,
  path: "/",
  secure: process.env.NODE_ENV === "production",
  maxAge: 60 * 60 * 8,
};

export async function getLocalUserId(): Promise<string | null> {
  const store = await cookies();
  return store.get(LOCAL_SESSION_COOKIE)?.value ?? null;
}

export async function requireLocalUserId(): Promise<string> {
  const userId = await getLocalUserId();
  if (!userId) {
    throw new PosActionError("UNAUTHENTICATED", "You must be signed in.");
  }
  return userId;
}

export async function setLocalSession(userId: string): Promise<void> {
  const store = await cookies();
  // In Server Actions the cookie store is mutable; the cast keeps the helper
  // usable in both Server Component and Server Action contexts.
  (store as unknown as { set: (name: string, value: string, options: typeof COOKIE_OPTIONS) => void }).set(
    LOCAL_SESSION_COOKIE,
    userId,
    COOKIE_OPTIONS,
  );
}

export async function clearLocalSession(): Promise<void> {
  const store = await cookies();
  (store as unknown as { set: (name: string, value: string, options: Record<string, unknown>) => void }).set(
    LOCAL_SESSION_COOKIE,
    "",
    { ...COOKIE_OPTIONS, maxAge: 0 },
  );
}
