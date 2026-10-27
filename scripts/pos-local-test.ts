import assert from "node:assert/strict";
import {
  getLocalDb,
  LOCAL_DEMO_USERS,
  localAssignDriver,
  localCustomerSignIn,
  localClearTransportRate,
  localCreateCategory,
  localCreateOrder,
  localGetDeliverySettings,
  localRegisterCustomer,
  localGetPublicMenu,
  localLoadDashboardData,
  localUpdateEmployee,
  localSetTransportRate,
  localSignIn,
  localTransition,
} from "../lib/pos/local-db";

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
    "Transport rate starts unconfigured",
    initial.settings.per_km_rate === null,
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

  const settings = await localSetTransportRate(ADMIN.id, {
    perKmRate: 1.0,
    freeDistanceKm: 2.0,
  });
  check("Admin transport rate set", settings.per_km_rate !== null);

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
      cashCollectedAmount: 1,
    },
  });
  check("DISPATCHED -> DELIVERED", order.status === "DELIVERED");
  check(
    "Dynamic transport cost calculated",
    Number(order.transport_cost) === 1,
    String(order.transport_cost),
  );
  check("Cash evidence recorded", Number(order.cash_collected_amount) === 1);
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
    "Transport settings persisted",
    persistedSettings.per_km_rate !== null,
    String(persistedSettings.per_km_rate),
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
  check("Admin cleared transport rate", cleared.per_km_rate === null);
  const afterClear = await localGetDeliverySettings();
  check("Cleared rate persisted", afterClear.per_km_rate === null);

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

  const newCustomer = await localRegisterCustomer({
    name: "Local Auth Test Customer",
    email: "new.customer@macrobox.local",
    phone: "+94000000123",
    password: "LocalTest123!",
  });
  check("Customer registered with email and phone", Boolean(newCustomer.userId));

  const emailSignIn = await localCustomerSignIn(
    "new.customer@macrobox.local",
    "LocalTest123!",
  );
  check("Customer signs in with email", emailSignIn.userId === newCustomer.userId);

  const phoneSignIn = await localCustomerSignIn("+94 000 000 123", "LocalTest123!");
  check("Customer signs in with phone", phoneSignIn.userId === newCustomer.userId);

  const db = await getLocalDb();
  const phoneLookup = await db.query<{ email: string | null }>(
    "select public.find_customer_signin_email($1) as email",
    ["+94000000123"],
  );
  check(
    "Server-only phone-to-email lookup works",
    phoneLookup.rows[0]?.email === "new.customer@macrobox.local",
  );

  console.log("\nALL LOCAL POS CHECKS PASSED");
}

main().catch((error) => {
  console.error("LOCAL POS TEST FAILED:", error);
  process.exit(1);
});
