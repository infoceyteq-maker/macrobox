"use server";

import { runAction } from "@/lib/pos/action-result";
import { isLocalMode } from "@/lib/pos/config";
import { normalizeDatabaseError, PosActionError } from "@/lib/pos/errors";
import { requireLocalUserId } from "@/lib/pos/local-session";
import { localUpdateEmployee } from "@/lib/pos/local-db";
import { updateEmployeeSchema, type UpdateEmployeeInput } from "@/lib/pos/schemas";
import { requirePosSession } from "@/lib/pos/supabase-server";
import type { ActionResult, AppUserRow } from "@/lib/pos/types";

/** Admin-only employee role/status/profile management. RLS is authoritative. */
export async function updateEmployeeAction(
  input: UpdateEmployeeInput,
): Promise<ActionResult<AppUserRow>> {
  return runAction(async () => {
    const parsed = updateEmployeeSchema.parse(input);
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localUpdateEmployee(userId, parsed);
    }

    const { supabase } = await requirePosSession();
    const patch: Record<string, unknown> = {
      role: parsed.role,
      status: parsed.status,
      name: parsed.name,
    };
    if (parsed.phone !== undefined) patch.phone = parsed.phone;
    if (parsed.salaryStructure !== undefined) patch.salary_structure = parsed.salaryStructure;

    const { data, error } = await supabase
      .from("app_users")
      .update(patch)
      .eq("id", parsed.userId)
      .select()
      .single();

    if (error) throw normalizeDatabaseError(error);
    if (!data) throw new PosActionError("EMPTY_RESULT", "Employee was not updated.");
    return data as AppUserRow;
  });
}
