import type { AppRole, OrderStatus } from "./types";

/**
 * Normal, role-specific lifecycle edges. ADMIN intentionally bypasses this
 * matrix inside public.transition_order_status(); the database remains the
 * authoritative enforcement point.
 *
 * FRONT_DESK is included because PENDING -> ACCEPTED is described as a
 * Front/Admin action. Manager is an operational supervisor and can perform
 * every normal sequential transition. Kitchen is limited to preparation work.
 */
export const ORDER_TRANSITIONS: Readonly<
  Record<OrderStatus, Readonly<Partial<Record<OrderStatus, readonly AppRole[]>>>>
> = {
  PENDING: {
    ACCEPTED: ["ADMIN", "MANAGER", "FRONT_DESK"],
  },
  ACCEPTED: {
    PREPARING: ["ADMIN", "MANAGER", "KITCHEN"],
  },
  PREPARING: {
    READY: ["ADMIN", "MANAGER", "KITCHEN"],
  },
  READY: {
    DISPATCHED: ["ADMIN", "MANAGER", "FRONT_DESK"],
  },
  DISPATCHED: {
    DELIVERED: ["ADMIN", "MANAGER", "DRIVER"],
  },
  DELIVERED: {
    CLOSED: ["ADMIN", "MANAGER"],
  },
  CLOSED: {},
};

export function normalTransitionRoles(
  from: OrderStatus,
  to: OrderStatus,
): readonly AppRole[] {
  return ORDER_TRANSITIONS[from][to] ?? [];
}

/**
 * True when the transition is a standard matrix edge for the role.
 * ADMIN always returns true, including skipped or corrective transitions.
 */
export function roleCanTransition(
  role: AppRole,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  if (role === "ADMIN") return true;
  return normalTransitionRoles(from, to).includes(role);
}

export function isAdminOverride(
  role: AppRole,
  from: OrderStatus,
  to: OrderStatus,
): boolean {
  return role === "ADMIN" && normalTransitionRoles(from, to).length === 0;
}

export const ADMIN_ROLE: AppRole = "ADMIN";
