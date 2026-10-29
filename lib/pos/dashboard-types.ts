import type {
  AppRole,
  AppUserRow,
  CategoryRow,
  DeliverySettingsRow,
  ExpenseRow,
  OrderAuditEventRow,
  OrderItemRow,
  OrderRow,
  OrderStatusHistoryRow,
  OrderStatusTransitionRow,
  ProductRow,
} from "./types";

export interface DirectoryUser {
  id: string;
  name: string;
  email: string | null;
}

export interface DashboardOrder extends OrderRow {
  order_items?: OrderItemRow[];
  order_status_history?: OrderStatusHistoryRow[];
  order_audit_events?: OrderAuditEventRow[];
  customer?: DirectoryUser | null;
  driver?: DirectoryUser | null;
}

export interface DashboardData {
  actor: AppUserRow;
  users: AppUserRow[];
  drivers: DirectoryUser[];
  customers: DirectoryUser[];
  orders: DashboardOrder[];
  products: ProductRow[];
  expenses: ExpenseRow[];
  categories: CategoryRow[];
  settings: DeliverySettingsRow;
  transitions: OrderStatusTransitionRow[];
  history: OrderStatusHistoryRow[];
  events: OrderAuditEventRow[];
  generatedAt: string;
  schema: string;
  roleLabels: Record<AppRole, string>;
}
