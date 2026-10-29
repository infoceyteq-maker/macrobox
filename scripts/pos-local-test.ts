import assert from "node:assert/strict";
import {
  getLocalDb,
  LOCAL_DEMO_USERS,
  localActivateTieredTransportRate,
  localAssignDriver,
  localLinkCustomerEmail,
  localSendEmailOtp,
  localSendPhoneOtp,
  localUpdateCustomerProfile,
  localVerifyEmailOtp,
  localVerifyPhoneOtp,
  localClearTransportRate,
  localCreateCategory,
  localCreateOrder,
  localGetActor,
  localGetDeliverySettings,
  localGetPublicMenu,
  localLoadDashboardData,
  localUpdateEmployee,
  localSetTransportRate,
  localSignIn,
  localTransition,
} from "../lib/pos/local-db";
import {
  calculateTransportCost,
  isTransportConfigured,
} from "../lib/pos/transport";

const ADMIN = LOCAL_DEMO_USERS.find((user) => user.role === "ADMIN")!;
const DRIVER = LOCAL_DEMO_USERS.find((user) => user.role === "DRIVER")!;
const CUSTOMER = LOCAL_DEMO_USERS.find((user) => user.role === "CUSTOMER")!;

function check(name: string, condition: boolean, detail = "") {
  assert.ok(condition, `${name}${detail ? ` :: ${detail}` : ""}`);
  console.log(`PASS  ${name}${detail ? ` :: ${detail}` : ""}`);
}

async function main() {
  await getLocalDb();
  check("PGlite migration applied", true, "same 202610270001_pos_core.sql");

  const signedInId = await localSignIn("admin@macrobox.local", "MacroBox@2026!");
  check("Local demo sign-in", signedInId === ADMIN.id, signedInId);

  const initial = await localLoadDashboardData(ADMIN.id);
  check("Actor is Admin", initial.actor.role === "ADMIN");
  check("Six demo users seeded", initial.users.length === 6);
  check("Five weekday categories seeded", initial.categories.length === 5);
  check("Five catalog products seeded", initial.products.length === 5);
  check("Six transition rules seeded", initial.transitions.length === 6);
  check(
    "Approved LKR tiered transport model is active",
    initial.settings.rate_model === "TIERED_LKR" &&
      initial.settings.is_configured === true &&
      Number(initial.settings.per_km_rate) === 60,
  );

  const publicMenu = await localGetPublicMenu();
  check(
    "Public menu readable without a session",
    publicMenu.products.length === 5 && publicMenu.categories.length === 5,
    `${publicMenu.products.length} products / ${publicMenu.categories.length} categories`,
  );
  check(
    "Public menu keeps price-pending placeholders",
    publicMenu.products.every((product) => Number(product.basePrice) === 0),
  );

  const tierCases: Array<[number, number]> = [
    [0, 150],
    [3, 150],
    [3.01, 270],
    [4, 270],
    [4.01, 370],
    [5, 370],
    [5.5, 400],
    [6, 430],
    [10, 670],
  ];
  for (const [distance, expected] of tierCases) {
    check(
      `TypeScript tier ${distance} km -> LKR ${expected}`,
      calculateTransportCost(distance) === expected,
      String(calculateTransportCost(distance)),
    );
  }
  check(
    "Negative distance rejected by TypeScript calculator",
    (() => {
      try {
        calculateTransportCost(-1);
        return false;
      } catch {
        return true;
      }
    })(),
  );

  const db = await getLocalDb();
  for (const [distance, expected] of tierCases) {
    const result = await db.query<{ cost: number | string }>(
      "select public.calculate_transport_cost($1) as cost",
      [distance],
    );
    check(
      `SQL tier ${distance} km -> LKR ${expected}`,
      Number(result.rows[0]?.cost) === expected,
      String(result.rows[0]?.cost),
    );
  }

  const activated = await localActivateTieredTransportRate(ADMIN.id);
  check(
    "Admin activation keeps exact tier configuration",
    activated.is_configured === true &&
      activated.rate_model === "TIERED_LKR" &&
      Number(activated.base_rate) === 150 &&
      Number(activated.fourth_km_rate) === 120 &&
      Number(activated.fifth_km_rate) === 100 &&
      Number(activated.beyond_rate_per_km) === 60,
  );

  const activeProduct = initial.products.find((product) => product.is_active);
  assert.ok(activeProduct, "No active product found");

  let order = await localCreateOrder(ADMIN.id, {
    customerId: CUSTOMER.id,
    items: [{ productId: activeProduct.id, quantity: 1 }],
    deliveryAddress: "Local live test address",
  });
  check("Order created", order.status === "PENDING", order.id);

  order = await localTransition(ADMIN.id, "ACCEPTED", {
    orderId: order.id,
    expectedStatus: order.status,
    expectedVersion: Number(order.version),
    metadata: { note: "local test" },
  });
  check("PENDING -> ACCEPTED", order.status === "ACCEPTED");

  order = await localTransition(ADMIN.id, "PREPARING", {
    orderId: order.id,
    expectedStatus: order.status,
    expectedVersion: Number(order.version),
  });
  check("ACCEPTED -> PREPARING", order.status === "PREPARING");

  order = await localTransition(ADMIN.id, "READY", {
    orderId: order.id,
    expectedStatus: order.status,
    expectedVersion: Number(order.version),
  });
  check("PREPARING -> READY", order.status === "READY");

  order = await localAssignDriver(ADMIN.id, {
    orderId: order.id,
    driverId: DRIVER.id,
    dispatch: true,
    expectedStatus: "READY",
  });
  check("READY -> DISPATCHED with driver", order.status === "DISPATCHED");
  check("Driver assigned", order.driver_id === DRIVER.id);

  order = await localTransition(ADMIN.id, "DELIVERED", {
    orderId: order.id,
    expectedStatus: "DISPATCHED",
    expectedVersion: Number(order.version),
    metadata: {
      driverId: DRIVER.id,
      distanceKm: 3,
      signatureUrl: "local-test-signature",
      cashCollectedAmount: 150,
    },
  });
  check("DISPATCHED -> DELIVERED", order.status === "DELIVERED");
  check(
    "Tier 1 transport cost calculated",
    Number(order.transport_cost) === 150,
    String(order.transport_cost),
  );
  check("Cash evidence recorded", Number(order.cash_collected_amount) === 150);
  check("Signature evidence recorded", Boolean(order.delivery_signature_url));

  order = await localTransition(ADMIN.id, "CLOSED", {
    orderId: order.id,
    expectedStatus: "DELIVERED",
    expectedVersion: Number(order.version),
    metadata: { cashSettlementReference: "LOCAL-TEST-SETTLE" },
  });
  check("DELIVERED -> CLOSED", order.status === "CLOSED");
  check("Settlement reference recorded", Boolean(order.cash_settlement_reference));

  const final = await localLoadDashboardData(ADMIN.id);
  const closed = final.orders.find((entry) => entry.id === order.id);
  assert.ok(closed, "Closed order missing from dashboard");
  check("Dashboard shows CLOSED order", closed.status === "CLOSED");
  check("Order timeline has creation + six transitions", (closed.order_status_history ?? []).length === 7);
  check("Audit events recorded", (closed.order_audit_events ?? []).length > 0);
  check(
    "Global status history visible",
    final.history.some((entry) => entry.order_id === order.id && entry.to_status === "CLOSED"),
  );

  let blocked = false;
  try {
    await localCreateCategory(DRIVER.id, {
      name: "Should Fail",
      slug: "should-fail",
      sortOrder: 0,
      isActive: true,
    });
  } catch (error) {
    blocked = error instanceof Error && /FORBIDDEN|role/i.test(error.message);
  }
  check("Driver blocked from Admin category creation", blocked);

  const persistedSettings = await localGetDeliverySettings();
  check(
    "Tiered transport settings persisted",
    isTransportConfigured(persistedSettings) &&
      persistedSettings.rate_model === "TIERED_LKR",
    `${persistedSettings.rate_model} / ${String(persistedSettings.per_km_rate)}`,
  );

  let clearBlocked = false;
  try {
    await localClearTransportRate(DRIVER.id);
  } catch (error) {
    clearBlocked =
      error instanceof Error && /ADMIN|FORBIDDEN|permission/i.test(error.message);
  }
  check("Driver blocked from clearing transport rate", clearBlocked);

  const cleared = await localClearTransportRate(ADMIN.id);
  check(
    "Admin cleared transport rate",
    cleared.per_km_rate === null && cleared.is_configured === false,
  );
  const afterClear = await localGetDeliverySettings();
  check(
    "Cleared rate persisted",
    afterClear.per_km_rate === null && !isTransportConfigured(afterClear),
  );

  const legacyFlat = await localSetTransportRate(ADMIN.id, {
    perKmRate: 10,
    freeDistanceKm: 2,
  });
  check(
    "Legacy flat-rate setter remains available",
    legacyFlat.rate_model === "FLAT" && Number(legacyFlat.per_km_rate) === 10,
  );
  const flatCost = await db.query<{ cost: number | string }>(
    "select public.calculate_transport_cost($1) as cost",
    [5],
  );
  check(
    "Legacy flat formula still computes correctly",
    Number(flatCost.rows[0]?.cost) === 30,
    String(flatCost.rows[0]?.cost),
  );

  const reactivated = await localActivateTieredTransportRate(ADMIN.id);
  check(
    "Admin reactivated approved tiered rate",
    reactivated.rate_model === "TIERED_LKR" &&
      reactivated.is_configured === true &&
      calculateTransportCost(5) === 370,
  );

  let employeeBlocked = false;
  try {
    await localUpdateEmployee(DRIVER.id, {
      userId: CUSTOMER.id,
      role: "CUSTOMER",
      status: "ACTIVE",
      name: "Should Fail",
      phone: null,
      salaryStructure: {},
    });
  } catch (error) {
    employeeBlocked =
      error instanceof Error && /ADMIN|FORBIDDEN|role/i.test(error.message);
  }
  check("Driver blocked from employee management", employeeBlocked);

  const employee = await localUpdateEmployee(ADMIN.id, {
    userId: CUSTOMER.id,
    role: "CUSTOMER",
    status: "ACTIVE",
    name: "MacroBox Customer Verified",
    phone: null,
    salaryStructure: {},
  });
  check("Admin employee management update", employee.name === "MacroBox Customer Verified");

  const otpPhone = "+94000000123";
  const otpSend = await localSendPhoneOtp(otpPhone);
  check("Local phone OTP issued", otpSend.otpSent && otpSend.devOtp === "123456");

  let invalidOtpBlocked = false;
  try {
    await localVerifyPhoneOtp(otpPhone, "000000");
  } catch (error) {
    invalidOtpBlocked = error instanceof Error && /INVALID_OTP|invalid/i.test(error.message);
  }
  check("Invalid phone OTP rejected", invalidOtpBlocked);

  const otpCustomer = await localVerifyPhoneOtp(otpPhone, otpSend.devOtp);
  check("Phone OTP creates customer profile", Boolean(otpCustomer.userId));

  const otpReturning = await localVerifyPhoneOtp(otpPhone, (await localSendPhoneOtp(otpPhone)).devOtp);
  check("Returning phone OTP reuses same customer", otpReturning.userId === otpCustomer.userId);

  const updatedProfile = await localUpdateCustomerProfile(otpCustomer.userId, {
    name: "OTP Test Customer",
    deliveryAddress: "12 Preview Lane",
    deliveryNotes: "Gate code 1234",
  });
  check(
    "Customer profile saves optional details",
    updatedProfile.name === "OTP Test Customer" &&
      updatedProfile.delivery_address === "12 Preview Lane" &&
      updatedProfile.delivery_notes === "Gate code 1234" &&
      updatedProfile.profile_completed_at !== null,
  );

  const linkedEmail = await localLinkCustomerEmail(
    otpCustomer.userId,
    "otp.customer@macrobox.local",
  );
  check("Optional email link attaches email", linkedEmail.email === "otp.customer@macrobox.local");

  const leadPhone = "+94000000456";
  const leadSend = await localSendPhoneOtp(leadPhone, {
    name: "Lead Test Customer",
    email: "lead@macrobox.local",
    location: "Kandy",
  });
  const leadCustomer = await localVerifyPhoneOtp(leadPhone, leadSend.devOtp);
  const leadProfile = await localGetActor(leadCustomer.userId);
  check(
    "Lead registration saves name and delivery city",
    leadProfile.name === "Lead Test Customer" &&
      leadProfile.delivery_address === "Kandy",
    `${leadProfile.name} / ${leadProfile.delivery_address}`,
  );
  check(
    "Lead email stays unverified (not a profile sign-in email)",
    leadProfile.email === null,
  );

  const emailOtpSend = await localSendEmailOtp("Email.Customer@MacroBox.local");
  check("Local email OTP issued", emailOtpSend.otpSent && emailOtpSend.devOtp === "123456");

  let invalidEmailOtpBlocked = false;
  try {
    await localVerifyEmailOtp("email.customer@macrobox.local", "000000");
  } catch (error) {
    invalidEmailOtpBlocked = error instanceof Error && /INVALID_OTP|invalid/i.test(error.message);
  }
  check("Invalid email OTP rejected", invalidEmailOtpBlocked);

  const emailCustomer = await localVerifyEmailOtp(
    "email.customer@macrobox.local",
    emailOtpSend.devOtp,
  );
  const emailProfile = await localGetActor(emailCustomer.userId);
  check(
    "Email OTP creates customer profile",
    emailProfile.role === "CUSTOMER" &&
      emailProfile.email === "email.customer@macrobox.local",
    emailProfile.email ?? "",
  );

  await localSendEmailOtp("email.customer@macrobox.local");
  const emailReturning = await localVerifyEmailOtp(
    "email.customer@macrobox.local",
    "123456",
  );
  check("Returning email OTP reuses same customer", emailReturning.userId === emailCustomer.userId);

  let staffEmailBlocked = false;
  try {
    await localSendEmailOtp("admin@macrobox.local");
    await localVerifyEmailOtp("admin@macrobox.local", "123456");
  } catch (error) {
    staffEmailBlocked = error instanceof Error && /STAFF_EMAIL|staff/i.test(error.message);
  }
  check("Staff email blocked from customer email OTP", staffEmailBlocked);

  const phoneLookup = await db.query<{ email: string | null }>(
    "select public.find_customer_signin_email($1) as email",
    [otpPhone],
  );
  check(
    "Server-only phone-to-email lookup works",
    phoneLookup.rows[0]?.email === "otp.customer@macrobox.local",
  );

  console.log("\nALL LOCAL POS CHECKS PASSED");
}

main().catch((error) => {
  console.error("LOCAL POS TEST FAILED:", error);
  process.exit(1);
});
