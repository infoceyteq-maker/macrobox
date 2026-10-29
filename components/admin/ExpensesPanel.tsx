"use client";

import { useMemo, useState, type FormEvent } from "react";

import { addExpenseAction } from "@/app/actions/pos";
import { cn, formatAmount, formatDate, NEU } from "@/components/ui/neu";
import { notify } from "@/lib/ui/toast";
import {
  EXPENSE_CATEGORIES,
  type AppRole,
  type ExpenseCategory,
  type ExpenseRow,
} from "@/lib/pos/types";

interface ExpensesPanelProps {
  expenses: ExpenseRow[];
  actorRole: AppRole;
  masterMode: boolean;
  onChanged: () => Promise<void>;
}

interface ExpenseFormState {
  category: ExpenseCategory;
  supplier: string;
  amount: string;
  remark: string;
}

const emptyForm: ExpenseFormState = {
  category: "Grocery",
  supplier: "",
  amount: "",
  remark: "",
};

function asNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export default function ExpensesPanel({
  expenses,
  actorRole,
  masterMode,
  onChanged,
}: ExpensesPanelProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [form, setForm] = useState<ExpenseFormState>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [search, setSearch] = useState("");

  const sortedExpenses = useMemo(
    () =>
      [...expenses].sort(
        (a, b) =>
          new Date(b.expense_date).getTime() - new Date(a.expense_date).getTime(),
      ),
    [expenses],
  );

  const filteredExpenses = useMemo(() => {
    const query = search.trim().toLowerCase();
    return sortedExpenses.filter((expense) => {
      if (categoryFilter !== "All" && expense.category !== categoryFilter) return false;
      if (!query) return true;
      return [expense.category, expense.supplier, expense.remark ?? ""]
        .join(" ")
        .toLowerCase()
        .includes(query);
    });
  }, [categoryFilter, search, sortedExpenses]);

  const totalExpenses = useMemo(
    () => expenses.reduce((sum, expense) => sum + asNumber(expense.amount), 0),
    [expenses],
  );

  const currentMonthExpenses = useMemo(() => {
    const now = new Date();
    return expenses
      .filter((expense) => {
        const date = new Date(expense.expense_date);
        return (
          !Number.isNaN(date.getTime()) &&
          date.getFullYear() === now.getFullYear() &&
          date.getMonth() === now.getMonth()
        );
      })
      .reduce((sum, expense) => sum + asNumber(expense.amount), 0);
  }, [expenses]);

  const topCategory = useMemo(() => {
    const totals = new Map<string, number>();
    for (const expense of expenses) {
      totals.set(
        expense.category,
        (totals.get(expense.category) ?? 0) + asNumber(expense.amount),
      );
    }
    return [...totals.entries()].sort((a, b) => b[1] - a[1])[0] ?? null;
  }, [expenses]);

  if (!masterMode || actorRole !== "ADMIN") {
    return (
      <section className={cn(NEU.card, "p-6")}>
        <h2 className="font-display text-xl font-bold">Expenses</h2>
        <p className="mt-2 text-sm leading-6 text-[#6f7a74]">
          This module is restricted to Master Admin. Customers, Front Desk, Kitchen,
          Managers, and Drivers cannot access expense or P&amp;L records.
        </p>
      </section>
    );
  }

  function openAdd() {
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function closeForm() {
    if (saving) return;
    setFormOpen(false);
    setFormError(null);
  }

  async function handleAddExpense(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError(null);

    const amount = Number(form.amount);
    if (!form.supplier.trim()) {
      setFormError("Supplier is required.");
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setFormError("Amount must be greater than 0 LKR.");
      return;
    }

    // Mirrors the requested handleAddExpense flow (loading -> payload -> insert
    // -> success/refetch or error), but the insert runs through the Admin-only
    // Server Action so RBAC and RLS are enforced server-side.
    setSaving(true);
    try {
      const result = await addExpenseAction({
        category: form.category,
        supplier: form.supplier.trim(),
        amount,
        remark: form.remark.trim() ? form.remark.trim() : null,
      });

      if (!result.ok) {
        const failure = `[${result.code}] ${result.error}`;
        setFormError(failure);
        notify.error("Expense not saved", failure);
        return;
      }

      notify.success(
        "Expense recorded",
        `${result.data.category} · LKR ${formatAmount(result.data.amount)} added to P&L expenses.`,
      );
      setForm(emptyForm);
      setFormOpen(false);
      await onChanged();
    } catch (caught) {
      const failure =
        caught instanceof Error ? caught.message : "Unexpected expense save error.";
      setFormError(failure);
      notify.error("Expense not saved", failure);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6">
      <section className={cn(NEU.card, "p-5 sm:p-6")}>
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#7CA982]">
              Finance · Master Admin only
            </p>
            <h2 className="mt-2 font-display text-2xl font-bold">Expenses Dashboard</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-[#5f6d65]">
              Record operating and purchasing costs for the Master Admin P&amp;L. New expenses
              are timestamped automatically and attributed to the signed-in Admin; they are
              never exposed to Customers, Front Desk, or Drivers.
            </p>
          </div>
          <button type="button" onClick={openAdd} className={NEU.buttonPrimary}>
            Add Expense
          </button>
        </div>

        <div className="mt-5 grid gap-3 sm:grid-cols-3">
          <div className={cn(NEU.inset, "px-4 py-3")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
              Total logged expenses
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              LKR {formatAmount(totalExpenses)}
            </p>
          </div>
          <div className={cn(NEU.inset, "px-4 py-3")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
              This month
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              LKR {formatAmount(currentMonthExpenses)}
            </p>
          </div>
          <div className={cn(NEU.inset, "px-4 py-3")}>
            <p className="text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
              Largest category
            </p>
            <p className="mt-1 font-display text-2xl font-bold">
              {topCategory ? topCategory[0] : "—"}
            </p>
            <p className="text-xs text-[#6f7a74]">
              {topCategory ? `LKR ${formatAmount(topCategory[1])}` : "No expenses yet"}
            </p>
          </div>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-[1fr_220px]">
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
              Search expenses
            </span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className={NEU.input}
              placeholder="Search supplier, category, remark…"
            />
          </label>
          <label className="block">
            <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
              Category
            </span>
            <select
              value={categoryFilter}
              onChange={(event) => setCategoryFilter(event.target.value)}
              className={NEU.input}
            >
              <option>All</option>
              {EXPENSE_CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <section className={cn(NEU.card, "overflow-hidden p-0")}>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead>
              <tr className="bg-[#F7F6F2] text-xs uppercase tracking-wider text-[#6f7a74]">
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Category</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Remark</th>
              </tr>
            </thead>
            <tbody>
              {filteredExpenses.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-[#6f7a74]">
                    No expenses recorded yet. Use Add Expense to record the first cost.
                  </td>
                </tr>
              ) : (
                filteredExpenses.map((expense) => (
                  <tr key={expense.id} className="border-t border-white/70 align-top">
                    <td className="whitespace-nowrap px-4 py-3">
                      {formatDate(expense.expense_date)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={NEU.badge}>{expense.category}</span>
                    </td>
                    <td className="px-4 py-3 font-semibold">{expense.supplier}</td>
                    <td className="whitespace-nowrap px-4 py-3 font-bold">
                      LKR {formatAmount(expense.amount)}
                    </td>
                    <td className="max-w-[360px] px-4 py-3 text-[#5f6d65]">
                      {expense.remark || "—"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {formOpen ? (
        <div className="fixed inset-0 z-[100] flex items-end justify-center bg-[#2E3033]/35 backdrop-blur-sm sm:items-center sm:p-6">
          <button
            type="button"
            aria-label="Close expense form"
            onClick={closeForm}
            className="absolute inset-0 h-full w-full cursor-default"
          />
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="expense-form-title"
            className={cn(
              NEU.card,
              "relative max-h-[92vh] w-full max-w-xl overflow-y-auto rounded-b-none bg-[#F7F6F2] p-5 sm:rounded-[1.75rem] sm:p-7",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-bold uppercase tracking-[0.24em] text-[#7CA982]">
                  Finance · Expenses
                </p>
                <h3 id="expense-form-title" className="mt-2 font-display text-2xl font-bold">
                  Add Expense
                </h3>
                <p className="mt-1 text-sm text-[#6f7a74]">
                  The date and Admin attribution are captured automatically.
                </p>
              </div>
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className={cn(NEU.button, "!px-3 !py-2 text-xs")}
              >
                Close
              </button>
            </div>

            <form onSubmit={(event) => void handleAddExpense(event)} className="mt-6 space-y-4">
              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Expense Category
                </span>
                <select
                  value={form.category}
                  onChange={(event) =>
                    setForm((prev) => ({
                      ...prev,
                      category: event.target.value as ExpenseCategory,
                    }))
                  }
                  className={NEU.input}
                  required
                >
                  {EXPENSE_CATEGORIES.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Supplier
                </span>
                <input
                  value={form.supplier}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, supplier: event.target.value }))
                  }
                  className={NEU.input}
                  placeholder="Shop, person, or entity paid"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Amount (LKR)
                </span>
                <input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={form.amount}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, amount: event.target.value }))
                  }
                  className={NEU.input}
                  placeholder="0.00"
                  required
                />
              </label>

              <label className="block">
                <span className="mb-2 block text-xs font-semibold uppercase tracking-wider text-[#6f7a74]">
                  Remark <span className="normal-case text-[#8b9890]">(optional)</span>
                </span>
                <textarea
                  value={form.remark}
                  onChange={(event) =>
                    setForm((prev) => ({ ...prev, remark: event.target.value }))
                  }
                  className={cn(NEU.input, "min-h-24 resize-y")}
                  placeholder="e.g. Purchased extra chicken for Wednesday"
                />
              </label>

              {formError ? (
                <p className="rounded-2xl bg-[#f7e2de] px-4 py-3 text-sm font-medium text-[#8a3b2f]">
                  {formError}
                </p>
              ) : null}

              <div className="flex flex-wrap justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeForm}
                  disabled={saving}
                  className={NEU.button}
                >
                  Cancel
                </button>
                <button type="submit" disabled={saving} className={NEU.buttonPrimary}>
                  {saving ? "Saving…" : "Save Expense"}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
