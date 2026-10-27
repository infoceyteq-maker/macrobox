/** Shared Soft-UI tokens. Every customer/admin/driver surface uses these. */
export const NEU = {
  page: "min-h-screen bg-[#DCE6DA] text-[#2E3033]",
  card:
    "rounded-[1.75rem] border border-white/70 bg-[#DCE6DA] shadow-[10px_10px_22px_#b7c4b5,-10px_-10px_22px_#ffffff]",
  cardSmall:
    "rounded-2xl border border-white/70 bg-[#DCE6DA] shadow-[7px_7px_15px_#b7c4b5,-7px_-7px_15px_#ffffff]",
  inset:
    "rounded-2xl bg-[#DCE6DA] shadow-[inset_7px_7px_14px_#b7c4b5,inset_-7px_-7px_14px_#ffffff]",
  insetTiny:
    "rounded-xl bg-[#DCE6DA] shadow-[inset_4px_4px_9px_#b7c4b5,inset_-4px_-4px_9px_#ffffff]",
  input:
    "w-full rounded-2xl border-0 bg-[#DCE6DA] px-4 py-3 text-sm text-[#2E3033] shadow-[inset_7px_7px_14px_#b7c4b5,inset_-7px_-7px_14px_#ffffff] outline-none placeholder:text-[#8b9890] focus:ring-2 focus:ring-[#8FBC8F]",
  button:
    "rounded-2xl bg-[#F7F6F2] px-4 py-3 text-sm font-semibold text-[#3d4a42] shadow-[6px_6px_13px_#c6d0c2,-6px_-6px_13px_#ffffff] transition active:shadow-[inset_6px_6px_12px_#b7c4b5,inset_-6px_-6px_12px_#ffffff] disabled:cursor-not-allowed disabled:opacity-55",
  buttonPrimary:
    "rounded-2xl bg-[#8FBC8F] px-4 py-3 text-sm font-semibold text-[#22301f] shadow-[6px_6px_13px_#a9b9a7,-6px_-6px_13px_#ffffff] transition hover:bg-[#7CA982] active:shadow-[inset_6px_6px_12px_#7ba47d,inset_-6px_-6px_12px_#a4d4a1] disabled:cursor-not-allowed disabled:opacity-55",
  badge:
    "inline-flex items-center rounded-full bg-[#e3eddf] px-3 py-1 text-xs font-bold text-[#3f6b45] shadow-[3px_3px_7px_#c6d0c2,-3px_-3px_7px_#ffffff]",
  track:
    "h-2.5 w-full overflow-hidden rounded-full bg-[#cbd8c7] shadow-[inset_3px_3px_6px_#aebfaa,inset_-3px_-3px_6px_#f6fff3]",
  fill: "h-full rounded-full bg-[#8FBC8F] shadow-[2px_2px_5px_#7ba47d,-2px_-2px_5px_#a4d4a1]",
} as const;

export function cn(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

export function asNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined || value === "") return 0;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function formatAmount(value: number | string | null | undefined): string {
  return asNumber(value).toFixed(2);
}

export function shortId(value: string | null | undefined): string {
  return value ? value.slice(0, 8) : "—";
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return `${date.toISOString().replace("T", " ").slice(0, 16)} UTC`;
}
