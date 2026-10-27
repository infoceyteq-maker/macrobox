import { ZodError } from "zod";
import type { ActionFailure } from "./types";

export class PosActionError extends Error {
  readonly code: string;
  readonly details?: unknown;

  constructor(code: string, message: string, details?: unknown) {
    super(message);
    this.name = "PosActionError";
    this.code = code;
    this.details = details;
  }
}

type DatabaseErrorLike = {
  message?: string | null;
  code?: string | null;
  details?: string | null;
  hint?: string | null;
};

const KNOWN_SQL_ERRORS: Record<string, string> = {
  UNAUTHENTICATED: "You must be signed in.",
  USER_NOT_PROVISIONED: "Your account is not provisioned for the POS system.",
  USER_INACTIVE: "This account is not active.",
  ORDER_NOT_FOUND: "Order not found.",
  PRODUCT_NOT_FOUND: "Product not found.",
  DRIVER_NOT_FOUND: "Driver not found.",
  ASSIGNEE_IS_NOT_DRIVER: "The selected user is not a Driver.",
  DRIVER_INACTIVE: "The selected Driver is not active.",
  DRIVER_REQUIRED_FOR_DISPATCH: "Assign an active Driver before dispatch.",
  DRIVER_NOT_ASSIGNED_TO_ORDER: "You are not assigned to this order.",
  ORDER_TRANSITION_NOT_ALLOWED: "Your role cannot perform this status transition.",
  ORDER_STATUS_CONFLICT: "The order changed status. Refresh and try again.",
  ORDER_VERSION_CONFLICT: "The order changed. Refresh and try again.",
  ORDER_ALREADY_IN_STATUS: "The order is already in that status.",
  ORDER_ALREADY_FINALIZED: "This order is already finalized.",
  ORDER_NOT_READY_FOR_DRIVER: "Manager driver assignment requires READY status.",
  ORDER_CREATE_NOT_ALLOWED: "Your role cannot create orders.",
  CUSTOMERS_CREATE_OWN_ORDERS_ONLY: "Customers can create only their own orders.",
  INVALID_CUSTOMER: "The selected customer is invalid.",
  ORDER_ITEMS_REQUIRED: "At least one order item is required.",
  INVALID_ORDER_ITEM: "An order item is malformed.",
  INVALID_PRODUCT_ID: "An order item has an invalid product ID.",
  INVALID_QUANTITY: "An order item has an invalid quantity.",
  PRODUCT_NOT_AVAILABLE: "A product is unavailable or hidden.",
  PRODUCT_VISIBILITY_ADMIN_ONLY: "Only Admin can change product visibility.",
  TRANSPORT_RATE_ADMIN_ONLY: "Only Admin can configure the transport rate.",
  TRANSPORT_RATE_NOT_CONFIGURED: "Admin has not configured the per-km transport rate.",
  INVALID_PER_KM_RATE: "The per-km rate must be zero or greater.",
  INVALID_FREE_DISTANCE: "The free distance must be zero or greater.",
  INVALID_DISTANCE: "Distance must be zero or greater.",
  INVALID_TRANSPORT_SETTINGS: "Transport settings are invalid.",
  INVALID_OTP: "That verification code is invalid or has expired.",
  OTP_SEND_FAILED: "We could not send the verification code. Please try again.",
  SMS_PROVIDER_NOT_CONFIGURED: "SMS verification is not configured. Please contact support.",
  EMAIL_LINK_FAILED: "We could not send the email verification link. Please try again.",
  PROFILE_UPDATE_FAILED: "The profile could not be saved.",
  FORBIDDEN: "You do not have permission to perform this action.",
  DELIVERY_SIGNATURE_REQUIRED: "An e-signature is required at delivery.",
  DISTANCE_REQUIRED_AT_DELIVERY: "Distance is required when the Driver reaches the destination.",
  DISTANCE_CONFLICT: "The supplied distance conflicts with the recorded distance.",
  CASH_COLLECTED_AMOUNT_REQUIRED: "Cash collected amount is required.",
  CASH_COLLECTED_AMOUNT_MISMATCH: "Cash collected does not match the final total.",
  CASH_SETTLEMENT_REFERENCE_REQUIRED: "A cash settlement reference is required.",
  DELIVERY_EVIDENCE_REQUIRED_BEFORE_CLOSE: "Delivery evidence is required before closing an order.",
  DRIVER_ASSIGNMENT_ADMIN_OR_MANAGER_ONLY: "Only Admin or Manager can assign Drivers.",
  INVALID_METADATA: "Transition metadata must be a JSON object.",
  UNSUPPORTED_TARGET_STATUS: "Unsupported target status.",
};

function humanizeDatabaseMessage(message: string): string {
  const firstToken = message.trim().split(/[\s:]/, 1)[0] ?? "";
  return KNOWN_SQL_ERRORS[firstToken] ?? message;
}

export function normalizeDatabaseError(error: DatabaseErrorLike): PosActionError {
  const message = error.message ?? "Database request failed.";
  const firstToken = message.trim().split(/[\s:]/, 1)[0] ?? "";
  const code = KNOWN_SQL_ERRORS[firstToken] ? firstToken : "DATABASE_ERROR";

  return new PosActionError(
    code,
    humanizeDatabaseMessage(message),
    error.details ?? error.hint ?? undefined,
  );
}

export function toActionFailure(error: unknown): ActionFailure {
  if (error instanceof PosActionError) {
    return {
      ok: false,
      code: error.code,
      error: error.message,
      ...(error.details === undefined ? {} : { details: error.details }),
    };
  }

  if (error instanceof ZodError) {
    return {
      ok: false,
      code: "VALIDATION_ERROR",
      error: "Invalid action input.",
      details: error.issues.map((issue) => ({
        path: issue.path.join("."),
        message: issue.message,
      })),
    };
  }

  if (error instanceof Error) {
    return {
      ok: false,
      code: "INTERNAL_ERROR",
      error: error.message,
    };
  }

  return {
    ok: false,
    code: "INTERNAL_ERROR",
    error: "An unexpected error occurred.",
  };
}
