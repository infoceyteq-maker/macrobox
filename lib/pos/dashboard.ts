import "server-only";
import { normalizeDatabaseError, PosActionError } from "./errors";
import { isLocalMode, POS_SCHEMA } from "./config";
import { requireLocalUserId } from "./local-session";
import { localLoadDashboardData } from "./local-db";
import { requirePosSession } from "./supabase-server";
import type { DashboardData, DashboardOrder, DirectoryUser } from "./dashboard-types";
import type {
  AppRole,
  AppUserRow,
  CategoryRow,
  DeliverySettingsRow,
  OrderAuditEventRow,
  OrderStatusHistoryRow,
  OrderStatusTransitionRow,
  ProductRow,
} from "./types";

const ROLE_LABELS: Record<AppRole, string> = {
  ADMIN: "Admin",
  MANAGER: "Manager",
  FRONT_DESK: "Front Desk",
  KITCHEN: "Kitchen",
  DRIVER: "Driver",
  CUSTOMER: "Customer",
};

function assertNoError(error: { message: string } | null, fallback: string) {
  if (error) throw normalizeDatabaseError(error);
  if (!fallback) return;
}

export async function loadDashboardData(): Promise<DashboardData> {
  if (isLocalMode()) {
    const userId = await requireLocalUserId();
    return localLoadDashboardData(userId);
  }

  const { supabase, user } = await requirePosSession();

  const actorResult = await supabase
    .from("app_users")
    .select("*")
    .eq("id", user.id)
    .single();

  if (actorResult.error || !actorResult.data) {
    throw new PosActionError(
      "USER_NOT_PROVISIONED",
      "Your account is not provisioned for the POS system.",
    );
  }

  const actor = actorResult.data as AppUserRow;

  const [
    usersResult,
    driversResult,
    customersResult,
    ordersResult,
    productsResult,
    categoriesResult,
    settingsResult,
    transitionsResult,
    historyResult,
    eventsResult,
  ] = await Promise.all([
    supabase.from("app_users").select("*").order("name"),
    supabase.rpc("list_active_drivers"),
    supabase.rpc("list_active_customers"),
    supabase
      .from("orders")
      .select(
        "*, order_items(*), order_status_history(*), order_audit_events(*), customer:app_users!orders_customer_id_fkey(id,name,email), driver:app_users!orders_driver_id_fkey(id,name,email)",
      )
      .order("created_at", { ascending: false })
      .limit(50),
    supabase.from("products").select("*").order("title"),
    supabase.from("categories").select("*").order("sort_order"),
    supabase.from("delivery_settings").select("*").single(),
    supabase.from("order_status_transitions").select("*"),
    supabase
      .from("order_status_history")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
    supabase
      .from("order_audit_events")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(100),
  ]);

  assertNoError(usersResult.error, "Unable to load users.");
  assertNoError(ordersResult.error, "Unable to load orders.");
  assertNoError(productsResult.error, "Unable to load products.");
  assertNoError(categoriesResult.error, "Unable to load categories.");
  assertNoError(settingsResult.error, "Unable to load delivery settings.");
  assertNoError(transitionsResult.error, "Unable to load transition matrix.");
  assertNoError(historyResult.error, "Unable to load status history.");
  assertNoError(eventsResult.error, "Unable to load audit events.");

  if (!settingsResult.data) {
    throw new PosActionError("EMPTY_RESULT", "Delivery settings were not found.");
  }

  const drivers = (driversResult.data ?? []) as DirectoryUser[];
  const customers = (customersResult.data ?? []) as DirectoryUser[];

  return {
    actor,
    users: (usersResult.data ?? []) as AppUserRow[],
    drivers,
    customers,
    orders: (ordersResult.data ?? []) as unknown as DashboardOrder[],
    products: (productsResult.data ?? []) as ProductRow[],
    categories: (categoriesResult.data ?? []) as CategoryRow[],
    settings: settingsResult.data as DeliverySettingsRow,
    transitions: (transitionsResult.data ?? []) as OrderStatusTransitionRow[],
    history: (historyResult.data ?? []) as OrderStatusHistoryRow[],
    events: (eventsResult.data ?? []) as OrderAuditEventRow[],
    generatedAt: new Date().toISOString(),
    schema: POS_SCHEMA,
    roleLabels: ROLE_LABELS,
  };
}
