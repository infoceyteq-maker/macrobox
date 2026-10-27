export const APP_ROLES = [
  "ADMIN",
  "MANAGER",
  "FRONT_DESK",
  "KITCHEN",
  "DRIVER",
  "CUSTOMER",
] as const;

export type AppRole = (typeof APP_ROLES)[number];

export const EMPLOYEE_STATUSES = ["ACTIVE", "SUSPENDED", "TERMINATED"] as const;
export type EmployeeStatus = (typeof EMPLOYEE_STATUSES)[number];

export const ORDER_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PREPARING",
  "READY",
  "DISPATCHED",
  "DELIVERED",
  "CLOSED",
] as const;

export type OrderStatus = (typeof ORDER_STATUSES)[number];

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };
export type JsonObject = { [key: string]: JsonValue };

/** PostgreSQL numeric values may be returned as number or string. */
export type DecimalValue = number | string;

export interface AppUserRow {
  id: string;
  role: AppRole;
  name: string;
  email: string | null;
  phone: string | null;
  delivery_address: string | null;
  delivery_notes: string | null;
  profile_completed_at: string | null;
  salary_structure: JsonObject;
  status: EmployeeStatus;
  created_at: string;
  updated_at: string;
}

export interface CategoryRow {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductRow {
  id: string;
  title: string;
  category_id: string;
  ingredients: JsonValue[];
  macros: JsonObject;
  base_price: DecimalValue;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DeliverySettingsRow {
  id: boolean;
  free_distance_km: DecimalValue;
  per_km_rate: DecimalValue | null;
  rate_model: "TIERED_LKR" | "FLAT";
  currency_code: string;
  base_distance_km: DecimalValue;
  fourth_km_ceiling_km: DecimalValue;
  fifth_km_ceiling_km: DecimalValue;
  base_rate: DecimalValue;
  fourth_km_rate: DecimalValue;
  fifth_km_rate: DecimalValue;
  beyond_rate_per_km: DecimalValue;
  is_configured: boolean;
  updated_by: string | null;
  updated_at: string;
}

export interface OrderRow {
  id: string;
  customer_id: string;
  driver_id: string | null;
  status: OrderStatus;
  total_food_cost: DecimalValue;
  transport_cost: DecimalValue;
  final_total: DecimalValue;
  delivery_address: string | null;
  delivery_notes: string | null;
  distance_km: DecimalValue | null;
  transport_calculated_at: string | null;
  delivery_signature_url: string | null;
  cash_collected_amount: DecimalValue | null;
  cash_collected_at: string | null;
  cash_collected_by: string | null;
  cash_settlement_reference: string | null;
  cash_settled_at: string | null;
  accepted_by: string | null;
  accepted_at: string | null;
  preparing_by: string | null;
  preparing_at: string | null;
  ready_by: string | null;
  ready_at: string | null;
  dispatched_by: string | null;
  dispatched_at: string | null;
  delivered_by: string | null;
  closed_by: string | null;
  driver_assigned_by: string | null;
  driver_assigned_at: string | null;
  version: number;
  created_at: string;
  updated_at: string;
}

export interface OrderItemRow {
  id: string;
  order_id: string;
  product_id: string | null;
  title_snapshot: string;
  ingredients_snapshot: JsonValue[];
  macros_snapshot: JsonObject;
  quantity: number;
  unit_price: DecimalValue;
  line_total: DecimalValue;
  created_at: string;
}

export interface OrderStatusTransitionRow {
  from_status: OrderStatus;
  to_status: OrderStatus;
  allowed_roles: AppRole[];
}

export interface OrderStatusHistoryRow {
  id: number;
  order_id: string;
  from_status: OrderStatus | null;
  to_status: OrderStatus;
  actor_id: string;
  actor_role: AppRole;
  is_admin_override: boolean;
  metadata: JsonObject;
  created_at: string;
}

export interface OrderAuditEventRow {
  id: number;
  order_id: string;
  event_type: string;
  actor_id: string;
  actor_role: AppRole;
  metadata: JsonObject;
  created_at: string;
}

export type ActionFailure = {
  ok: false;
  error: string;
  code: string;
  details?: unknown;
};

export type ActionResult<T> = { ok: true; data: T } | ActionFailure;
