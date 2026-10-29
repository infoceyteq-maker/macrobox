import { z } from "zod";
import {
  APP_ROLES,
  EMPLOYEE_STATUSES,
  EXPENSE_CATEGORIES,
  ORDER_STATUSES,
} from "./types";

const uuid = z.uuid();
const orderStatus = z.enum(ORDER_STATUSES);
const jsonObject = z.record(z.string(), z.unknown());
const jsonArray = z.array(z.unknown());

const note = z.string().trim().min(1).max(1000).optional();
const expectedVersion = z.number().int().min(0).optional();
const expectedStatus = orderStatus.optional();

export const PRODUCT_DAY_ASSIGNMENTS = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Everyday",
] as const;
export type ProductDayAssignment = (typeof PRODUCT_DAY_ASSIGNMENTS)[number];
const productDayAssignment = z.enum(PRODUCT_DAY_ASSIGNMENTS);
const optionalProductText = (max: number) =>
  z.optional(
    z
      .string()
      .trim()
      .max(max)
      .nullable()
      .transform((value) => (value === "" ? null : value)),
  );

export const transitionMetadataSchema = z
  .object({
    driverId: uuid.optional(),
    distanceKm: z.number().min(0).max(100000).optional(),
    signatureUrl: z.string().trim().min(1).max(250000).optional(),
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
    signatureUrl: z.string().trim().min(1).max(250000),
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
    categoryId: uuid.optional(),
    dayAssignment: productDayAssignment.optional(),
    quantity: optionalProductText(120),
    productCategory: optionalProductText(120),
    ingredients: jsonArray.default([]),
    macros: jsonObject.default({}),
    // Legacy callers submit basePrice; Products Management submits the
    // explicit retailPrice. The server keeps base_price = retail_price so
    // order snapshots and the existing P&L/order math stay consistent.
    basePrice: z.number().min(0).optional(),
    costPrice: z.number().min(0).optional(),
    retailPrice: z.number().min(0).optional(),
    imageUrl: optionalProductText(5000),
    isActive: z.boolean().default(true),
  })
  .strict()
  .refine((input) => Boolean(input.categoryId || input.dayAssignment), {
    message: "A weekday/Everyday assignment or category is required.",
    path: ["dayAssignment"],
  })
  .refine((input) => input.retailPrice !== undefined || input.basePrice !== undefined, {
    message: "Wholesale/Retail Price is required.",
    path: ["retailPrice"],
  });

export type UpsertProductInput = z.infer<typeof upsertProductSchema>;

export const deleteProductSchema = z
  .object({
    productId: uuid,
  })
  .strict();

export type DeleteProductInput = z.infer<typeof deleteProductSchema>;

export const createExpenseSchema = z
  .object({
    category: z.enum(EXPENSE_CATEGORIES),
    supplier: z.string().trim().min(1).max(200),
    amount: z.number().positive().max(999_999_999),
    remark: z
      .string()
      .trim()
      .max(2000)
      .nullable()
      .optional()
      .transform((value) => (value === "" ? null : value)),
    // The form does not ask Admin to type a date: the Server Action captures
    // the current timestamp. This optional value exists for deterministic
    // imports/tests and is still validated as an ISO datetime.
    expenseDate: z.string().datetime({ offset: true }).optional(),
  })
  .strict();

export type CreateExpenseInput = z.infer<typeof createExpenseSchema>;

export const updateEmployeeSchema = z
  .object({
    userId: uuid,
    role: z.enum(APP_ROLES),
    status: z.enum(EMPLOYEE_STATUSES),
    name: z.string().trim().min(1).max(160),
    phone: z.string().trim().max(40).nullable().optional(),
    salaryStructure: jsonObject.optional(),
  })
  .strict();

export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
