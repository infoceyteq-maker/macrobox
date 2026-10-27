"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  assignDriverSchema,
  createCategorySchema,
  createOrderSchema,
  dispatchOrderSchema,
  recordDeliverySchema,
  setProductVisibilitySchema,
  setTransportRateSchema,
  settleOrderSchema,
  simpleTransitionSchema,
  transitionOrderStatusSchema,
  upsertProductSchema,
  type AssignDriverInput,
  type CreateCategoryInput,
  type CreateOrderInput,
  type DispatchOrderInput,
  type RecordDeliveryInput,
  type SetProductVisibilityInput,
  type SetTransportRateInput,
  type SettleOrderInput,
  type SimpleTransitionInput,
  type TransitionOrderStatusInput,
  type UpsertProductInput,
} from "@/lib/pos/schemas";
import {
  normalizeDatabaseError,
  PosActionError,
  toActionFailure,
} from "@/lib/pos/errors";
import { requirePosSession } from "@/lib/pos/supabase-server";
import { loadDashboardData } from "@/lib/pos/dashboard";
import { isLocalMode } from "@/lib/pos/config";
import { requireLocalUserId } from "@/lib/pos/local-session";
import {
  localActivateTieredTransportRate,
  localAssignDriver,
  localClearTransportRate,
  localCreateCategory,
  localCreateOrder,
  localGetActor,
  localGetDeliverySettings,
  localSetProductVisibility,
  localSetTransportRate,
  localTransition,
  localUpsertProduct,
} from "@/lib/pos/local-db";
import type { DashboardData } from "@/lib/pos/dashboard-types";
import type {
  ActionResult,
  AppUserRow,
  CategoryRow,
  DeliverySettingsRow,
  JsonObject,
  OrderRow,
  OrderStatus,
  ProductRow,
} from "@/lib/pos/types";

type RpcArgs = Record<string, unknown>;

function compactMetadata(metadata: Record<string, unknown>): JsonObject {
  return Object.fromEntries(
    Object.entries(metadata).filter(([, value]) => value !== undefined),
  ) as JsonObject;
}

async function callRpc<T>(
  supabase: SupabaseClient,
  functionName: string,
  args: RpcArgs,
): Promise<T> {
  const { data, error } = await supabase.rpc(functionName, args);

  if (error) {
    throw normalizeDatabaseError(error);
  }

  if (data === null || data === undefined) {
    throw new PosActionError(
      "EMPTY_RPC_RESULT",
      `The database function ${functionName} returned no result.`,
    );
  }

  return data as T;
}

async function runAction<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (error) {
    return toActionFailure(error);
  }
}

async function performTransition(
  toStatus: OrderStatus,
  input: {
    orderId: string;
    expectedStatus?: OrderStatus;
    expectedVersion?: number;
    metadata?: Record<string, unknown>;
  },
): Promise<OrderRow> {
  if (isLocalMode()) {
    const userId = await requireLocalUserId();
    return localTransition(userId, toStatus, input);
  }

  const { supabase } = await requirePosSession();

  return callRpc<OrderRow>(supabase, "transition_order_status", {
    p_order_id: input.orderId,
    p_to_status: toStatus,
    p_expected_status: input.expectedStatus ?? null,
    p_expected_version: input.expectedVersion ?? null,
    p_metadata: compactMetadata(input.metadata ?? {}),
  });
}

/**
 * Creates a PENDING order from active products. base_price is read inside the
 * database and snapshotted into order_items, so clients never submit prices.
 */
export async function createOrderAction(
  input: CreateOrderInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = createOrderSchema.parse(input);
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localCreateOrder(userId, parsed);
    }

    const { supabase } = await requirePosSession();

    return callRpc<OrderRow>(supabase, "create_order_with_items", {
      p_customer_id: parsed.customerId,
      p_items: parsed.items,
      p_delivery_address: parsed.deliveryAddress ?? null,
      p_delivery_notes: parsed.deliveryNotes ?? null,
    });
  });
}

/**
 * Generic state-machine entry point. Admin can target any status; the SQL
 * function bypasses the transition matrix while preserving money/delivery
 * invariants. Non-admin roles are restricted to their matrix edges.
 */
export async function transitionOrderStatusAction(
  input: TransitionOrderStatusInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = transitionOrderStatusSchema.parse(input);

    return performTransition(parsed.toStatus, {
      orderId: parsed.orderId,
      expectedStatus: parsed.expectedStatus,
      expectedVersion: parsed.expectedVersion,
      metadata: parsed.metadata,
    });
  });
}

export async function acceptOrderAction(
  input: SimpleTransitionInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = simpleTransitionSchema.parse(input);
    return performTransition("ACCEPTED", {
      orderId: parsed.orderId,
      expectedStatus: parsed.expectedStatus,
      expectedVersion: parsed.expectedVersion,
      metadata: { note: parsed.note },
    });
  });
}

export async function markOrderPreparingAction(
  input: SimpleTransitionInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = simpleTransitionSchema.parse(input);
    return performTransition("PREPARING", {
      orderId: parsed.orderId,
      expectedStatus: parsed.expectedStatus,
      expectedVersion: parsed.expectedVersion,
      metadata: { note: parsed.note },
    });
  });
}

export async function markOrderReadyAction(
  input: SimpleTransitionInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = simpleTransitionSchema.parse(input);
    return performTransition("READY", {
      orderId: parsed.orderId,
      expectedStatus: parsed.expectedStatus,
      expectedVersion: parsed.expectedVersion,
      metadata: { note: parsed.note },
    });
  });
}

/**
 * Assigns and dispatches in one atomic database transition when driverId is
 * supplied. Admin may call this from PENDING/ACCEPTED/READY; other roles are
 * still checked against the normal matrix by transition_order_status().
 */
export async function dispatchOrderAction(
  input: DispatchOrderInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = dispatchOrderSchema.parse(input);
    return performTransition("DISPATCHED", {
      orderId: parsed.orderId,
      expectedStatus: parsed.expectedStatus,
      expectedVersion: parsed.expectedVersion,
      metadata: {
        driverId: parsed.driverId,
        note: parsed.note,
      },
    });
  });
}

/**
 * Explicit Admin/Manager driver assignment. Manager is constrained to READY;
 * Admin may fast-track from an earlier status. Set dispatch=true to assign and
 * dispatch in one call.
 */
export async function assignDriverAction(
  input: AssignDriverInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = assignDriverSchema.parse(input);
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localAssignDriver(userId, parsed);
    }

    const { supabase } = await requirePosSession();

    return callRpc<OrderRow>(supabase, "assign_driver_to_order", {
      p_order_id: parsed.orderId,
      p_driver_id: parsed.driverId,
      p_dispatch: parsed.dispatch,
      p_expected_status: parsed.expectedStatus,
    });
  });
}

/**
 * Called when the Driver reaches the destination. This is the only point where
 * distance-based transport cost is written to the order and final_total grows.
 * Signature + cash collected are mandatory.
 */
export async function recordDeliveryAction(
  input: RecordDeliveryInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = recordDeliverySchema.parse(input);
    return performTransition("DELIVERED", {
      orderId: parsed.orderId,
      expectedStatus: parsed.expectedStatus,
      expectedVersion: parsed.expectedVersion,
      metadata: {
        driverId: parsed.driverId,
        distanceKm: parsed.distanceKm,
        signatureUrl: parsed.signatureUrl,
        cashCollectedAmount: parsed.cashCollectedAmount,
        note: parsed.note,
      },
    });
  });
}

/** Admin/Manager cash settlement after DELIVERED. */
export async function settleOrderAction(
  input: SettleOrderInput,
): Promise<ActionResult<OrderRow>> {
  return runAction(async () => {
    const parsed = settleOrderSchema.parse(input);
    return performTransition("CLOSED", {
      orderId: parsed.orderId,
      expectedStatus: parsed.expectedStatus,
      expectedVersion: parsed.expectedVersion,
      metadata: {
        cashSettlementReference: parsed.cashSettlementReference,
        note: parsed.note,
      },
    });
  });
}

/** Admin-only configuration for the dynamic transport formula. */
export async function setTransportRateAction(
  input: SetTransportRateInput,
): Promise<ActionResult<DeliverySettingsRow>> {
  return runAction(async () => {
    const parsed = setTransportRateSchema.parse(input);
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localSetTransportRate(userId, parsed);
    }

    const { supabase } = await requirePosSession();

    return callRpc<DeliverySettingsRow>(supabase, "set_transport_rate", {
      p_per_km_rate: parsed.perKmRate,
      p_free_distance_km: parsed.freeDistanceKm ?? null,
    });
  });
}

/** Admin-only activation of the approved LKR distance-tiered transport rate. */
export async function activateTieredTransportRateAction(): Promise<
  ActionResult<DeliverySettingsRow>
> {
  return runAction(async () => {
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localActivateTieredTransportRate(userId);
    }

    const { supabase } = await requirePosSession();
    return callRpc<DeliverySettingsRow>(supabase, "activate_tiered_transport_rate", {});
  });
}

/** Admin-only control to remove the configured transport rate. */
export async function clearTransportRateAction(): Promise<
  ActionResult<DeliverySettingsRow>
> {
  return runAction(async () => {
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localClearTransportRate(userId);
    }

    const { supabase } = await requirePosSession();
    return callRpc<DeliverySettingsRow>(supabase, "clear_transport_rate", {});
  });
}

/** Admin-only product visibility toggle. */
export async function setProductVisibilityAction(
  input: SetProductVisibilityInput,
): Promise<ActionResult<ProductRow>> {
  return runAction(async () => {
    const parsed = setProductVisibilitySchema.parse(input);
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localSetProductVisibility(userId, parsed);
    }

    const { supabase } = await requirePosSession();

    return callRpc<ProductRow>(supabase, "set_product_active", {
      p_product_id: parsed.productId,
      p_is_active: parsed.isActive,
    });
  });
}

/** Admin-only category creation. */
export async function createCategoryAction(
  input: CreateCategoryInput,
): Promise<ActionResult<CategoryRow>> {
  return runAction(async () => {
    const parsed = createCategorySchema.parse(input);
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localCreateCategory(userId, parsed);
    }

    const { supabase } = await requirePosSession();

    const { data, error } = await supabase
      .from("categories")
      .insert({
        name: parsed.name,
        slug: parsed.slug,
        description: parsed.description ?? null,
        sort_order: parsed.sortOrder,
        is_active: parsed.isActive,
      })
      .select()
      .single();

    if (error) throw normalizeDatabaseError(error);
    if (!data) throw new PosActionError("EMPTY_RESULT", "Category was not created.");

    return data as CategoryRow;
  });
}

/**
 * Admin-only product create/update. Ingredients and macros are stored as JSONB;
 * no menu copy, prices, or nutrition values are generated here.
 */
export async function upsertProductAction(
  input: UpsertProductInput,
): Promise<ActionResult<ProductRow>> {
  return runAction(async () => {
    const parsed = upsertProductSchema.parse(input);
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localUpsertProduct(userId, parsed);
    }

    const { supabase } = await requirePosSession();

    const { data, error } = await supabase
      .from("products")
      .upsert({
        ...(parsed.id ? { id: parsed.id } : {}),
        title: parsed.title,
        category_id: parsed.categoryId,
        ingredients: parsed.ingredients,
        macros: parsed.macros,
        base_price: parsed.basePrice,
        is_active: parsed.isActive,
      })
      .select()
      .single();

    if (error) throw normalizeDatabaseError(error);
    if (!data) throw new PosActionError("EMPTY_RESULT", "Product was not saved.");

    return data as ProductRow;
  });
}

/** Read helper for an admin settings screen. */
export async function getDeliverySettingsAction(): Promise<
  ActionResult<DeliverySettingsRow>
> {
  return runAction(async () => {
    if (isLocalMode()) {
      return localGetDeliverySettings();
    }

    const { supabase } = await requirePosSession();
    const { data, error } = await supabase
      .from("delivery_settings")
      .select("*")
      .single();

    if (error) throw normalizeDatabaseError(error);
    if (!data) {
      throw new PosActionError("EMPTY_RESULT", "Delivery settings were not found.");
    }

    return data as DeliverySettingsRow;
  });
}

/** Read helper so a dashboard can label the current session's capabilities. */
export async function getCurrentActorAction(): Promise<ActionResult<AppUserRow>> {
  return runAction(async () => {
    if (isLocalMode()) {
      const userId = await requireLocalUserId();
      return localGetActor(userId);
    }

    const { supabase, user } = await requirePosSession();
    const { data, error } = await supabase
      .from("app_users")
      .select("*")
      .eq("id", user.id)
      .single();

    if (error) throw normalizeDatabaseError(error);
    if (!data) {
      throw new PosActionError(
        "USER_NOT_PROVISIONED",
        "Your account is not provisioned for the POS system.",
      );
    }

    return data as AppUserRow;
  });
}

/** Full read model for the live POS/Admin dashboard. */
export async function getDashboardDataAction(): Promise<ActionResult<DashboardData>> {
  return runAction(() => loadDashboardData());
}
