# MacroBox POS & Restaurant Management — Backend Design

This document covers the backend architecture and the live Admin/POS UI built on top of it. The original lunch-catalog UI remains at `/`; the staff portal is at `/login` and `/pos`.

## 1. Files added

| Path | Purpose |
| --- | --- |
| `supabase/migrations/202610270001_pos_core.sql` | Complete Supabase/PostgreSQL schema, enums, constraints, RLS, audit tables, RPCs, and the authoritative order state machine. |
| `supabase/migrations/202610270002_pos_isolated_schema.sql` | Applies the core SQL into the connected project's isolated `macrobox_pos` schema, preserving legacy `public.orders`. |
| `supabase/migrations/202610270003_pos_ui_directory_rpcs.sql` | Read-only Driver/Customer directory RPCs used by the dashboard. |
| `supabase/migrations/202610270004_pos_clear_transport_rate.sql` | Admin-only `clear_transport_rate()` RPC for returning billing to unconfigured; supports both `public` and `macrobox_pos` installs. |
| `supabase/migrations/202610270005_public_menu_read.sql` | Anonymous RLS read for active categories/products only, enabling the public digital menu and cart. |
| `supabase/demo-seed.sql` | Optional verification seed: six role accounts, five weekday categories, and exact supplied catalog products with `0.00` price placeholders. |
| `app/actions/pos.ts` | Next.js Server Actions for cart-to-order creation, lifecycle transitions, driver assignment, delivery, cash settlement, transport-rate config, and product visibility. |
| `lib/pos/types.ts` | Shared TypeScript row types, enums, and `ActionResult<T>`. |
| `lib/pos/schemas.ts` | Zod-validated Server Action inputs. |
| `lib/pos/order-state-machine.ts` | Mirrors the normal RBAC transition matrix for server-side capability checks. The database remains authoritative. |
| `lib/pos/transport.ts` | Pure estimator matching the SQL transport formula. |
| `lib/pos/env.ts`, `lib/pos/supabase-server.ts`, `lib/pos/errors.ts` | Lazy env validation, cookie-based Supabase server client, and normalized action errors. |
| `.env.example` | Required public Supabase env vars and live-mode switch. |
| `app/actions/auth.ts` | Supabase/local sign-in, one-click demo sign-in, and sign-out Server Actions. |
| `app/login/page.tsx` | Branded staff login with role demo buttons. |
| `app/pos/page.tsx`, `components/PosDashboard.tsx` | Live unified Admin/POS dashboard: overview, orders, new order, menu admin, transport settings, clear-rate control, and audit. |
| `app/orders/page.tsx`, `components/CustomerOrders.tsx` | Protected customer order-tracking page with live status timeline and itemized totals. |
| `app/driver/page.tsx`, `components/DriverPortal.tsx` | Focused Driver/Admin delivery portal with drawn e-signature, distance, cash collection, and assignment summaries. |
| `components/SignaturePad.tsx` | Canvas-based drawn e-signature capture producing a PNG data URI stored as delivery evidence. |
| `components/cart/*`, `app/cart/page.tsx` | Customer cart provider, drawer, and COD checkout using `createOrderAction`. |
| `components/admin/*`, `app/admin/page.tsx` | Omnipotent Master Admin quick control, employee management, and provisional P&L/financials. |
| `components/billing/*`, `app/bill/[orderId]/page.tsx` | Neumorphic e-bill, share/copy link, and 80mm thermal KOT / bill print layouts. |
| `components/tracking/*` | Simulated live driver route, ETA/return messages, and Google Maps placeholder. |
| `components/ui/*`, `app/globals.css` | Shared Soft UI tokens, global `sonner` toasts, and `@media print` thermal rules. |
| `app/actions/public-menu.ts`, `app/actions/employees.ts` | Anonymous active-menu read and Admin-only employee updates. |
| `proxy.ts` | Refreshes Supabase auth or checks the local live-mode session cookie and protects `/pos`, `/admin`, `/orders`, `/driver`, and `/bill`. |
| `lib/pos/local-db.ts`, `lib/pos/local-session.ts`, `lib/pos/catalog-seed.ts` | Sandboxed PGlite live engine running the same SQL migration and RPCs. |
| `scripts/pos-local-test.ts` | Automated local lifecycle test (`npm run test:pos`). |

## 2. Core entities

### `app_users`

One table for employees and customers, linked 1:1 to `auth.users`.

- `id` — UUID primary key, references `auth.users(id)`.
- `role` — `ADMIN | MANAGER | FRONT_DESK | KITCHEN | DRIVER | CUSTOMER`.
- `name`, `email`, `phone`.
- `salary_structure` — JSONB object.
- `status` — `ACTIVE | SUSPENDED | TERMINATED`.
- `created_at`, `updated_at`.

`FRONT_DESK` is included explicitly because `PENDING -> ACCEPTED` is described as a Front/Admin responsibility. New Auth users are created as `CUSTOMER` by a trigger; an existing admin or controlled SQL process promotes staff. Users cannot self-assign roles.

### `categories` and `products`

- `categories`: `id`, `name`, `slug`, `description`, `sort_order`, `is_active`, timestamps.
- `products`: `id`, `title`, `category_id`, `ingredients` JSONB array, `macros` JSONB object, `base_price NUMERIC(12,2)`, `is_active`, timestamps.

`is_active` is the Admin-controlled visibility toggle. A trigger rejects visibility changes from non-Admin actors, and RLS restricts catalog writes to Admin.

No menu items, prices, nutrition values, or salary values are seeded. Those must come from verified Admin input.

### `orders`

- `id`, `customer_id`, nullable `driver_id`.
- `status` — `PENDING | ACCEPTED | PREPARING | READY | DISPATCHED | DELIVERED | CLOSED`.
- `total_food_cost`, `transport_cost`, generated `final_total = total_food_cost + transport_cost`.
- Delivery fields: address, notes, `distance_km`, `transport_calculated_at`.
- e-signature / cash fields: `delivery_signature_url`, `cash_collected_amount`, `cash_collected_at`, `cash_collected_by`, `cash_settlement_reference`, `cash_settled_at`.
- Lifecycle actor/timestamp columns for accepted, preparing, ready, dispatched, delivered, closed.
- `version` for optimistic concurrency, plus timestamps.

`order_items` snapshots product title, ingredients, macros, quantity, and `unit_price` at purchase time. `line_total` is generated as `unit_price * quantity`.

`order_status_history` records every transition, including `is_admin_override`. `order_audit_events` records non-status events such as driver assignment.

## 3. Order lifecycle and RBAC

Normal lifecycle:

```text
PENDING -> ACCEPTED -> PREPARING -> READY -> DISPATCHED -> DELIVERED -> CLOSED
```

Normal matrix enforced by `order_status_transitions`:

| From | To | Non-Admin roles |
| --- | --- | --- |
| `PENDING` | `ACCEPTED` | `MANAGER`, `FRONT_DESK` |
| `ACCEPTED` | `PREPARING` | `MANAGER`, `KITCHEN` |
| `PREPARING` | `READY` | `MANAGER`, `KITCHEN` |
| `READY` | `DISPATCHED` | `MANAGER`, `FRONT_DESK` |
| `DISPATCHED` | `DELIVERED` | `MANAGER`, `DRIVER` |
| `DELIVERED` | `CLOSED` | `MANAGER` |

Kitchen is limited to preparation work: it cannot accept, dispatch, deliver, close, or jump to arbitrary statuses. Drivers can act only on orders assigned to them.

### Admin omnipotence

`public.transition_order_status()` checks `app_current_actor().role = 'ADMIN'` and bypasses the matrix entirely. Admin can therefore:

- accept an order without Front Desk;
- move `PENDING -> READY` directly, bypassing the Kitchen view;
- dispatch directly by supplying an active `driverId`;
- perform corrective backward transitions when needed;
- still use the normal sequential flow when staff are present.

Admin omnipotence is deliberately **not** financial omnipotence. The database still requires:

- an active, role-`DRIVER` assignee for `DISPATCHED`, `DELIVERED`, and `CLOSED`;
- e-signature, distance, and matching cash amount at `DELIVERED`;
- a cash settlement reference at `CLOSED`;
- delivery evidence before `CLOSED`.

Every transition is locked with `SELECT ... FOR UPDATE`, supports `expectedStatus` / `expectedVersion`, increments `version`, writes audit history, and runs in one transaction.

## 4. Dynamic transport billing

`delivery_settings` holds `free_distance_km` (default `2`) and a nullable `per_km_rate`. **No monetary rate is invented or seeded**; Admin configures it with `setTransportRateAction()` / `set_transport_rate()`.

SQL formula:

```text
if distance <= free_distance_km: cost = 0
else: cost = round((distance - free_distance_km) * per_km_rate, 2)
```

Example with `distance = 5 km`, `free_distance_km = 2`, and a configured rate of `120`:

```text
(5 - 2) * 120 = 360
```

The authoritative `calculate_transport_cost()` runs inside `transition_order_status()` when the target is `DELIVERED`. That is the moment the Driver reaches the destination. `transport_cost` and `distance_km` are written then, and generated `final_total` updates automatically. `cashCollectedAmount` must equal `total_food_cost + transport_cost` within `0.01`.

`lib/pos/transport.ts` mirrors the formula for server-side estimates only; it never writes to an order.

## 5. Driver assignment

`assign_driver_to_order()`:

- allows only `ADMIN` or `MANAGER`;
- validates that the assignee has role `DRIVER` and status `ACTIVE`;
- for Manager, requires the order to be in `READY` by default;
- for Admin, allows early assignment so Admin can fast-track dispatch;
- records an `ORDER_DRIVER_ASSIGNED` audit event;
- can optionally dispatch in the same call with `dispatch: true`.

`dispatchOrderAction()` can also assign and dispatch atomically by passing `driverId` in transition metadata. This is the simplest Admin-dashboard path.

## 6. Server Actions

All actions return `ActionResult<T>` (`{ ok: true, data }` or `{ ok: false, code, error, details? }`). Inputs are Zod-validated. All order, lifecycle, financial, and employee RPCs use the signed-in user's JWT via `auth.uid()`; they do not require a service-role key. Customer provisioning in `app/actions/customer-auth.ts` is the only runtime path that uses `SUPABASE_SERVICE_ROLE_KEY`, and it is server-only.

| Action | Backend effect |
| --- | --- |
| `createOrderAction` | `create_order_with_items()` — creates `PENDING` order from active products and snapshots prices. |
| `transitionOrderStatusAction` | Generic state-machine transition; Admin may target any status. |
| `acceptOrderAction` | `PENDING -> ACCEPTED`. |
| `markOrderPreparingAction` | `ACCEPTED -> PREPARING`. |
| `markOrderReadyAction` | `PREPARING -> READY`, or Admin skip to `READY`. |
| `dispatchOrderAction` | Assigns active driver in metadata and moves to `DISPATCHED`. |
| `assignDriverAction` | `assign_driver_to_order()` with optional immediate dispatch. |
| `recordDeliveryAction` | Calculates/writes transport cost, e-signature, and cash; moves to `DELIVERED`. |
| `settleOrderAction` | Records cash settlement reference; moves to `CLOSED`. |
| `setTransportRateAction` | Admin-only `per_km_rate` / `free_distance_km` update. |
| `clearTransportRateAction` | Admin-only `clear_transport_rate()` RPC; sets `per_km_rate` back to `null` without changing past orders. |
| `updateEmployeeAction` | Admin-only `app_users` role/status/name/phone/salary JSON update; RLS is authoritative. |
| `getPublicMenuAction` | Anonymous active-category/product read for the public digital menu and cart. |
| `setProductVisibilityAction` | Admin-only `is_active` toggle. |
| `createCategoryAction`, `upsertProductAction` | Admin-only catalog writes. |
| `getDeliverySettingsAction`, `getCurrentActorAction` | Read helpers for a future dashboard. |

## 7. Security model

- RLS is enabled on every POS table.
- `SECURITY DEFINER` functions pin `search_path = public, pg_temp` and re-check the active actor.
- Customers can read only their own orders; Drivers can read assigned orders; staff read operational orders.
- Direct writes to orders, order items, history, and audit tables are intentionally not granted; mutations go through RPCs.
- Product visibility changes are blocked for non-Admin actors by both RLS and a trigger.
- `final_total` and `line_total` are generated columns, so clients cannot submit conflicting totals.
- `version` plus `expectedStatus` / `expectedVersion` protects against double-clicks and stale dashboards.

## 8. Setup

1. Add Supabase env vars from `.env.example`:

   ```bash
   NEXT_PUBLIC_SUPABASE_URL=...
   NEXT_PUBLIC_SUPABASE_ANON_KEY=...
   NEXT_PUBLIC_SUPABASE_SCHEMA=macrobox_pos
   NEXT_PUBLIC_POS_LIVE_MODE=supabase
   NEXT_PUBLIC_SITE_URL=https://your-project.vercel.app
   SUPABASE_SERVICE_ROLE_KEY=... # server-only customer provisioning
   ```

   `SUPABASE_SERVICE_ROLE_KEY` must be an encrypted/sensitive Vercel variable.
   It is never imported by client code. `POS_DEMO_PASSWORD` is local-preview only
   and should not be set in production.

   For sandboxed previews without outbound access to `*.supabase.co`, set
   `NEXT_PUBLIC_POS_LIVE_MODE=local`. The app then runs the same migration in
   PGlite in-process; no Supabase network call is made.

2. Apply the migration with the Supabase CLI or paste it into the Supabase SQL Editor:

   ```bash
   supabase db push
   # or
   psql "$DATABASE_URL" -f supabase/migrations/202610270001_pos_core.sql
   psql "$DATABASE_URL" -f supabase/migrations/202610270004_pos_clear_transport_rate.sql
   psql "$DATABASE_URL" -f supabase/migrations/202610270005_public_menu_read.sql
   psql "$DATABASE_URL" -f supabase/migrations/202610270006_customer_auth.sql
   psql "$DATABASE_URL" -f supabase/migrations/202610270007_customer_phone_normalization.sql
   ```

   On an existing project with conflicting `public.orders`, apply
   `202610270002_pos_isolated_schema.sql`,
   `202610270003_pos_ui_directory_rpcs.sql`,
   `202610270004_pos_clear_transport_rate.sql`,
   `202610270005_public_menu_read.sql`,
   `202610270006_customer_auth.sql`, and
   `202610270007_customer_phone_normalization.sql` instead, then set
   `NEXT_PUBLIC_SUPABASE_SCHEMA=macrobox_pos`.

3. Promote the first Admin through a controlled server-side/SQL process, for example:

   ```sql
   update public.app_users
   set role = 'ADMIN'
   where email = 'replace-with-existing-account@example.com';
   ```

4. Configure the transport rate once:

   ```ts
   await setTransportRateAction({
     perKmRate: 120,
     freeDistanceKm: 2,
   });
   ```

   The `120` above is only an illustrative value matching the formula example; it is not seeded by the migration. Admin can later call `clearTransportRateAction()` to return `per_km_rate` to `null` without changing historical orders.

5. Add categories/products with `createCategoryAction()` and `upsertProductAction()` using verified data. Toggle visibility with `setProductVisibilityAction()`.

## 9. How Admin interacts effortlessly

A unified Admin Dashboard only needs to call Server Actions; it does not need separate Kitchen/Front Desk screens. From one order row Admin can:

```ts
// 1. Accept without Front Desk.
await acceptOrderAction({ orderId });

// 2. Skip Kitchen entirely if no Kitchen user is logged in.
await markOrderReadyAction({ orderId });

// 3. Assign + dispatch to the mandatory Driver in one call.
await dispatchOrderAction({ orderId, driverId });

// 4. Driver reaches destination: e-sign + distance + cash collected.
// foodTotal, distanceKm, and perKmRate are read from the order/settings.
const expectedCash = foodTotal + calculateTransportCost({
  distanceKm,
  perKmRate,
  freeDistanceKm: 2,
});

await recordDeliveryAction({
  orderId,
  distanceKm,
  signatureUrl: "path-or-url-to-captured-signature",
  cashCollectedAmount: expectedCash,
});

// 5. Cash settled with Admin.
await settleOrderAction({
  orderId,
  cashSettlementReference: "till-bag-2026-10-27-001",
});
```

`cashCollectedAmount` must equal the order's `final_total` after transport is added. The `signatureUrl` remains a generic string so it can reference Supabase Storage, an object key, or another approved signature store; storage policy was not supplied. The live UI now captures a real drawn signature with `components/SignaturePad.tsx` and stores its PNG data URI directly in this field, so no external storage bucket is required for verification.

Admin can also call `transitionOrderStatusAction({ orderId, toStatus: "READY" })` directly from `PENDING`, or use `assignDriverAction({ ..., dispatch: true })`. Every skipped step is flagged in `order_status_history.is_admin_override`, so the unified dashboard remains fast **and** auditable.

## 10. Scope notes

- A live Admin/POS UI, login, customer tracking page, focused Driver portal, drawn e-signature capture, Admin clear-rate control, COD cart, Omnipotent Master Admin dashboard, employee/financial views, simulated tracking, e-bills, thermal printing, and global toasts are now included; see `POS_LIVE_TEST.md` and `docs/FOLDER_STRUCTURE.md` for routes and verification.
- No real prices, macros, ingredients, health claims, addresses, or salary values were invented. Seeded products use `0.00` as a “price pending” placeholder and preserve the supplied catalog copy verbatim.
- The connected Supabase project was modified only inside the isolated `macrobox_pos` schema; the existing legacy `public.orders` table and its 7 rows were preserved.
- Demo accounts and any temporary test transport rate are for verification only. The remote per-km rate was cleared back to `null` after testing.
