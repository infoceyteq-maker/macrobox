"use client";

import { useState, type FormEvent } from "react";
import { updateEmployeeAction } from "@/app/actions/employees";
import { cn, formatDate, NEU, shortId } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import {
  APP_ROLES,
  EMPLOYEE_STATUSES,
  type AppRole,
  type AppUserRow,
  type EmployeeStatus,
} from "@/lib/pos/types";

interface EmployeesPanelProps {
  users: AppUserRow[];
  isAdmin: boolean;
  onUpdated: () => void | Promise<void>;
}

const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  FRONT_DESK: "Front Desk",
  KITCHEN: "Kitchen",
  DRIVER: "Driver",
  CUSTOMER: "Customer",
};

export default function EmployeesPanel({ users, isAdmin, onUpdated }: EmployeesPanelProps) {
  const [busyId, setBusyId] = useState<string | null>(null);

  async function save(event: FormEvent<HTMLFormElement>, user: AppUserRow) {
    event.preventDefault();
    if (!isAdmin) {
      notify.error("Admin only", "Only an Admin can update employee records.");
      return;
    }
    const form = event.currentTarget;
    const data = new FormData(form);
    const salaryRaw = String(data.get("salaryStructure") || "{}").trim();
    let salaryStructure: Record<string, unknown>;
    try {
      const parsed = JSON.parse(salaryRaw || "{}") as unknown;
      if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
        throw new Error("Salary structure must be a JSON object.");
      }
      salaryStructure = parsed as Record<string, unknown>;
    } catch (error) {
      notify.error(
        "Invalid salary structure",
        error instanceof Error ? error.message : "Enter a JSON object.",
      );
      return;
    }

    const phone = String(data.get("phone") || "").trim();
    setBusyId(user.id);
    const result = await updateEmployeeAction({
      userId: user.id,
      role: String(data.get("role")) as AppRole,
      status: String(data.get("status")) as EmployeeStatus,
      name: String(data.get("name") || "").trim(),
      phone: phone || null,
      salaryStructure,
    });
    setBusyId(null);

    if (!result.ok) {
      notify.error("Employee update failed", `[${result.code}] ${result.error}`);
      return;
    }
    notify.success("Employee updated", `${result.data.name} · ${ROLE_LABELS[result.data.role]}`);
    await onUpdated();
  }

  return (
    <div className="space-y-5">
      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-[#7CA982]">
              Employee management
            </p>
            <h2 className="mt-1 font-display text-2xl font-bold">{users.length} profiles</h2>
          </div>
          <span className={cn(NEU.badge, "!text-[10px] uppercase tracking-widest")}>
            {isAdmin ? "Admin omnipotent" : "Read only"}
          </span>
        </div>
        <p className="mt-3 max-w-2xl text-sm leading-6 text-[#6f7a74]">
          New accounts are provisioned through Supabase Auth. This screen manages the existing role,
          status, contact, and salary-structure JSON. No salary values are invented here.
        </p>
      </section>

      <div className="grid gap-5 xl:grid-cols-2">
        {users.map((user) => (
          <form
            key={user.id}
            onSubmit={(event) => save(event, user)}
            className={cn(NEU.card, "space-y-4 p-5")}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="font-mono text-xs text-[#6f7a74]">#{shortId(user.id)}</p>
                <h3 className="mt-1 font-display text-lg font-bold">{user.name}</h3>
                <p className="mt-1 text-xs text-[#6f7a74]">{user.email || "No email"}</p>
              </div>
              <span
                className={cn(
                  "rounded-full px-3 py-1 text-[10px] font-bold uppercase tracking-widest",
                  user.status === "ACTIVE"
                    ? "bg-[#dcead7] text-[#3f6b45]"
                    : "bg-[#f4e7c9] text-[#7a5b1d]",
                )}
              >
                {user.status}
              </span>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Name
                </span>
                <input
                  name="name"
                  defaultValue={user.name}
                  className={NEU.input}
                  disabled={!isAdmin || busyId === user.id}
                  required
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Phone
                </span>
                <input
                  name="phone"
                  defaultValue={user.phone || ""}
                  placeholder="Not supplied"
                  className={NEU.input}
                  disabled={!isAdmin || busyId === user.id}
                />
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Role
                </span>
                <select
                  name="role"
                  defaultValue={user.role}
                  className={NEU.input}
                  disabled={!isAdmin || busyId === user.id}
                >
                  {APP_ROLES.map((role) => (
                    <option key={role} value={role}>
                      {ROLE_LABELS[role]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Status
                </span>
                <select
                  name="status"
                  defaultValue={user.status}
                  className={NEU.input}
                  disabled={!isAdmin || busyId === user.id}
                >
                  {EMPLOYEE_STATUSES.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <label className="block">
              <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                Salary structure (JSON)
              </span>
              <textarea
                name="salaryStructure"
                defaultValue={JSON.stringify(user.salary_structure ?? {}, null, 2)}
                className={cn(NEU.input, "min-h-24 resize-y font-mono text-xs")}
                disabled={!isAdmin || busyId === user.id}
              />
            </label>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-xs text-[#6f7a74]">Updated {formatDate(user.updated_at)}</p>
              <button
                type="submit"
                disabled={!isAdmin || busyId === user.id}
                className={cn(NEU.buttonPrimary, "min-w-32")}
              >
                {busyId === user.id ? "Saving…" : "Save employee"}
              </button>
            </div>
          </form>
        ))}
      </div>
    </div>
  );
}
