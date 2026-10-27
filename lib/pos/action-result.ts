import { toActionFailure } from "./errors";
import type { ActionResult } from "./types";

/** Shared Server Action wrapper so every UI gets the same typed result. */
export async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return toActionFailure(error);
  }
}
