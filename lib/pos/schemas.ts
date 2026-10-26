import { z } from "zod";
import { ORDER_STATUSES } from "./types";

const uuid = z.uuid();
const orderStatus = z.enum(ORDER_STATUSES);
const jsonObject = z.record(z.string(), z.unknown());
const jsonArray = z.array(z.unknown());

const note = z.string().trim().min(1).max(1000).optional();
const expectedVersion = z.number().int().min(0).optional();
const expectedStatus = orderStatus.optional();

export const transitionMetadataSchema = z
  .object({
    driverId: uuid.optional(),
    distanceKm: z.number().min(0).max(100000).optional(),
    signatureUrl: z.string().trim().min(1).max(2048).optional(),
    cashCollectedAmount: z.number().min(0).optional(),
    cashSettlementReference: z.string().trim().min(1).max(200).optional(),
    note,
  })
  .strict();

export const createOrderItemSchema = z
  .object({
    productId: uuid,
    quantity: z.number().int().positive().max(9999),
  })
  .strict();

export const createOrderSchema = z
  .object({
    customerId: uuid,
    items: z.array(createOrderItemSchema).min(1).max(200),
    deliveryAddress: z.string().trim().max(2000).optional(),
    deliveryNotes: z.string().trim().max(2000).optional(),
  })
  .strict();

export type CreateOrderInput = z.infer<typeof createOrderSchema>;

export const transitionOrderStatusSchema = z
  .object({
    orderId: uuid,
    toStatus: orderStatus,
    expectedStatus,
    expectedVersion,
    metadata: transitionMetadataSchema.default({}),
  })
  .strict();

export type TransitionOrderStatusInput = z.infer<typeof transitionOrderStatusSchema>;

export const simpleTransitionSchema = z
  .object({
    orderId: uuid,
    expectedStatus,
    expectedVersion,
    note,
  })
  .strict();

export type SimpleTransitionInput = z.infer<typeof simpleTransitionSchema>;

export const dispatchOrderSchema = z
  .object({
    orderId: uuid,
    driverId: uuid,
    expectedStatus,
    expectedVersion,
    note,
  })
  .strict();

export type DispatchOrderInput = z.infer<typeof dispatchOrderSchema>;

export const assignDriverSchema = z
  .object({
    orderId: uuid,
    driverId: uuid,
    dispatch: z.boolean().default(false),
    expectedStatus: orderStatus.default("READY"),
    expectedVersion,
  })
  .strict();

export type AssignDriverInput = z.infer<typeof assignDriverSchema>;

export const recordDeliverySchema = z
  .object({
    orderId: uuid,
    distanceKm: z.number().min(0).max(100000),
    signatureUrl: z.string().trim().min(1).max(2048),
    cashCollectedAmount: z.number().min(0),
    driverId: uuid.optional(),
    expectedStatus,
    expectedVersion,
    note,
  })
  .strict();

export type RecordDeliveryInput = z.infer<typeof recordDeliverySchema>;

export const settleOrderSchema = z
  .object({
    orderId: uuid,
    cashSettlementReference: z.string().trim().min(1).max(200),
    expectedStatus,
    expectedVersion,
    note,
  })
  .strict();

export type SettleOrderInput = z.infer<typeof settleOrderSchema>;

export const setTransportRateSchema = z
  .object({
    perKmRate: z.number().min(0),
    freeDistanceKm: z.number().min(0).max(100000).optional(),
  })
  .strict();

export type SetTransportRateInput = z.infer<typeof setTransportRateSchema>;

export const setProductVisibilitySchema = z
  .object({
    productId: uuid,
    isActive: z.boolean(),
  })
  .strict();

export type SetProductVisibilityInput = z.infer<typeof setProductVisibilitySchema>;

export const createCategorySchema = z
  .object({
    name: z.string().trim().min(1).max(160),
    slug: z.string().trim().min(1).max(160),
    description: z.string().trim().max(2000).optional(),
    sortOrder: z.number().int().min(0).max(999999).default(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;

export const upsertProductSchema = z
  .object({
    id: uuid.optional(),
    title: z.string().trim().min(1).max(200),
    categoryId: uuid,
    ingredients: jsonArray.default([]),
    macros: jsonObject.default({}),
    basePrice: z.number().min(0),
    isActive: z.boolean().default(true),
  })
  .strict();

export type UpsertProductInput = z.infer<typeof upsertProductSchema>;
