# MacroBox POS — Live Setup & Verification

## Status: live and tested

- Production build runs on **port 3000** in the Arena preview.
- Catalog: `/`
- Staff login: `/login`
- Unified Admin/POS dashboard: `/pos`
- Customer order tracking: `/orders`
- Cart & COD checkout: `/cart`
- Focused Driver portal: `/driver`
- Omnipotent Master Admin: `/admin`
- Shareable digital e-bill: `/bill/[orderId]`
- “Track my orders →”, “Master Admin →”, and “Staff / POS →” links are on the catalog.

The original Monday–Friday catalog UI, exact supplied copy, logo, fonts, brand greens, and meal images are unchanged.

---

## 1. Connected Supabase target

You gave the ref `pivcfbwnkubfotgjkgte` (“Macribox”), but the connected Supabase account could not see that project — `list_projects` returned only one active project. You then said to connect to **infoceyteq-maker’s Org**, so I used its visible active project:

| Field | Value |
| --- | --- |
| Organization | `infoceyteq-maker's Org` (`bfidjlnbamrvcuhcyrul`) |
| Project | `Umbrellacafe` |
| Ref | `kkyaekpsnjaualjiwirg` |
| Region | `ap-northeast-2` |
| Status | `ACTIVE_HEALTHY` |
| POS schema | `macrobox_pos` (isolated) |

### Why an isolated schema?

`Umbrellacafe` already has a legacy `public.orders` table with **7 rows**. Applying `create table if not exists public.orders` there would have silently left the wrong schema in place and could have exposed unrelated data. The POS migration was therefore applied into a dedicated `macrobox_pos` schema. The existing `public.orders`, `public.menu_items`, and their data were **not renamed, dropped, or modified**.

To use a different/new project, reconnect the Supabase app to that project or provide its exact ref/URL. Then set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, and `NEXT_PUBLIC_SUPABASE_SCHEMA=public` (or run the isolated-schema migration there).

---

## 2. Remote SQL migration applied

Applied through the Supabase connector:

1. `supabase/migrations/202610270001_pos_core.sql` — transformed into `macrobox_pos` by `202610270002_pos_isolated_schema.sql`.
2. `supabase/migrations/202610270003_pos_ui_directory_rpcs.sql` — `list_active_drivers()` and `list_active_customers()` for the dashboard.

Remote verification:

| Check | Result |
| --- | --- |
| `macrobox_pos` tables | 9 |
| RLS policies | 12 |
| Functions | 12 |
| Transition rules | 6 |
| `auth.users` trigger | `on_auth_user_created_macrobox_pos` |
| Active drivers RPC | 1 |
| Active customers RPC | 1 |

The six seeded transitions are exactly:

```text
PENDING    -> ACCEPTED    (ADMIN, MANAGER, FRONT_DESK)
ACCEPTED   -> PREPARING   (ADMIN, MANAGER, KITCHEN)
PREPARING  -> READY       (ADMIN, MANAGER, KITCHEN)
READY      -> DISPATCHED  (ADMIN, MANAGER, FRONT_DESK)
DISPATCHED -> DELIVERED   (ADMIN, MANAGER, DRIVER)
DELIVERED  -> CLOSED      (ADMIN, MANAGER)
```

---

## 3. Demo accounts

All six accounts use the demo password:

```text
MacroBox@2026!
```

| Role | Email |
| --- | --- |
| Admin | `admin@macrobox.local` |
| Manager | `manager@macrobox.local` |
| Front Desk | `frontdesk@macrobox.local` |
| Kitchen | `kitchen@macrobox.local` |
| Driver | `driver@macrobox.local` |
| Customer | `customer@macrobox.local` |

The login page has one-click demo buttons. The password is stored server-side in `.env.local` as `POS_DEMO_PASSWORD`; it is not placed in the browser bundle.

**Replace or disable these accounts before production.**

---

## 4. Seeded catalog data

Five categories and five products were seeded from the exact supplied weekday catalog:

- Monday, Tuesday, Wednesday, Thursday, Friday.
- Product title: `MacroBox - Healthy Foods`.
- Ingredients and macros copied verbatim, including Wednesday’s inconsistent supplied values.
- `base_price = 0.00` is a **placeholder meaning “price pending”**. No real price was invented.

The Admin → Menu screen lets you set an approved price, hide/activate products, add categories, and add products. No nutrition or health claims are generated.

The optional reproducible seed script is `supabase/demo-seed.sql`.

---

## 5. Live preview mode: Supabase vs local PGlite

The sandbox blocks direct HTTPS from the Next.js server to `*.supabase.co`, so Server Actions inside the preview cannot reach Supabase directly — a sign-in attempt produced `fetch failed`. To keep the live preview fully usable, the app has two modes:

### `NEXT_PUBLIC_POS_LIVE_MODE=local` (current sandbox preview)

- Runs `supabase/migrations/202610270001_pos_core.sql` inside **PGlite** in-process.
- Uses the same SQL functions: `create_order_with_items`, `transition_order_status`, `assign_driver_to_order`, `set_transport_rate`, `set_product_active`, etc.
- Seeds the same six users and five catalog products.
- Session is an HTTP-only local cookie; no Supabase network call is made.
- Perfect for sandboxed verification and previews.

### `NEXT_PUBLIC_POS_LIVE_MODE=supabase` (production / your own network)

- Uses `@supabase/ssr` with the signed-in user’s JWT.
- `auth.uid()` and the SQL RLS/functions remain authoritative.
- Point it at your project with:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-ref.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
NEXT_PUBLIC_SUPABASE_SCHEMA=public        # or macrobox_pos
NEXT_PUBLIC_POS_LIVE_MODE=supabase
```

`.env.local` is gitignored and already contains the connected project’s public URL/anon key plus local preview mode. No service-role key is used by the app.

---

## 6. UI / login delivered

- `app/login/page.tsx` — branded neumorphic login, normal email/password form, and six one-click demo roles.
- `app/pos/page.tsx` — server-protected dashboard route.
- `components/PosDashboard.tsx` — unified Admin/POS UI with:
  - Overview KPIs and live connection card.
  - Orders list and detail panel.
  - Standard transitions, Admin override, driver assignment, dispatch.
  - Drawn delivery e-signature, distance, cash collection with expected total.
  - Cash settlement to `CLOSED`.
  - New order form with product quantities and price-pending labels.
  - Menu admin: price edit, visibility, category/product create/update.
  - Transport settings with the exact `max(distance - freeDistance, 0) × rate` formula and Admin “Clear rate” control.
  - Status history and audit events.
  - Role-aware tabs, links to `/orders` and `/driver`, and sign-out.
- `components/SignaturePad.tsx` — canvas e-signature capture producing a PNG data URI stored as delivery evidence.
- `app/orders/page.tsx`, `components/CustomerOrders.tsx` — protected customer tracking with live status timeline, itemized totals, and refresh.
- `app/driver/page.tsx`, `components/DriverPortal.tsx` — focused Driver/Admin delivery portal with assigned-order filtering, expected cash, drawn signature, distance, and delivery recording.
- `proxy.ts` — refreshes Supabase auth or checks the local session cookie; protects `/pos`, `/orders`, and `/driver`.
- `app/page.tsx` — catalog plus “Track my orders →” and “Staff / POS →” links.

Driver RBAC was browser-tested: a Driver cannot see the Admin transport form or the New order tab.

### Complete module layer added

- **Customer menu** — Monday–Friday cards, detail modal with exact grammages and macro progress bars, global cart drawer, and `/cart` COD checkout.
- **Tracking** — `/orders` now includes a simulated live route, ETA, return messages (“Order Accepted”, “Driver on the way”), status timeline, and e-bill link.
- **Omnipotent Admin** — `/admin` adds incoming-order quick control (Accept, Preparing, Ready bypass, Assign & dispatch), Employees, Financials, Menu, Documents, Settings, and Audit.
- **Driver app** — `/driver` shows assigned orders, a Google Maps placeholder, live final e-bill, drawn e-signature, and “Delivered & Cash Collected”.
- **Documents** — `EBill`, `ThermalReceipt`, and `OrderDocuments` provide shareable neumorphic invoices plus 80mm black-and-white KOT / bill printing.
- **Notifications** — global `sonner` toasts for New Order Received, Order Dispatched, Payment Settled, cart actions, employee saves, print actions, and delivery evidence.
- **Public menu RLS** — migration `202610270005_public_menu_read.sql` grants `anon` read access to active categories/products only; no order or user data is exposed.

---

## 7. Verification results

### Code checks

```bash
npm run typecheck   # PASS
npm run build       # PASS — /admin, /cart, /bill, /bill/[orderId], /driver, /orders, /pos
npm run test:pos    # PASS
```

`npm run test:pos` uses PGlite to apply the real SQL migration and verifies:

- migration + seed integrity,
- Admin sign-in,
- transport rate configuration,
- `PENDING → ACCEPTED → PREPARING → READY → DISPATCHED → DELIVERED → CLOSED`,
- driver assignment,
- dynamic transport cost `1.00` for `3 km` with `2 km` free at a temporary `1.00/km` rate,
- e-signature and cash evidence,
- settlement reference,
- 7 timeline rows (creation + 6 transitions),
- audit events,
- Driver blocked from Admin category creation,
- Driver blocked from clearing the transport rate,
- Admin `clear_transport_rate()` returning the rate to `null`,
- anonymous active-menu read with five price-pending products,
- Driver blocked from employee management,
- Admin employee profile update.

### Browser E2E on the live preview

13/13 functional checks passed:

1. Login page rendered.
2. Admin demo sign-in.
3. Transport rate configured via UI.
4. Customer selected.
5. PENDING order created.
6. `ACCEPTED`.
7. `PREPARING`.
8. `READY`.
9. `DISPATCHED` with driver.
10. `DELIVERED` with signature + cash.
11. `CLOSED` with settlement.
12. Audit trail rendered.
13. Driver RBAC enforced.

Console errors: **none**. Page errors: **none**. The only failed network requests were expected `net::ERR_ABORTED` RSC prefetches during navigation.

Screenshots:

- `screenshots/01-login.png`
- `screenshots/02-admin-dashboard.png`
- `screenshots/03-order-closed.png`
- `screenshots/04-audit.png`
- `screenshots/05-driver-dashboard.png`
- `screenshots/06-customer-orders.png`
- `screenshots/07-driver-portal.png`
- `screenshots/08-drawn-signature.png`
- `screenshots/09-clear-rate.png`
- `screenshots/10-driver-role.png`
- `screenshots/11-catalog-cart.png`
- `screenshots/12-customer-tracking.png`
- `screenshots/13-digital-ebill.png`
- `screenshots/14-master-admin.png`
- `screenshots/15-documents-print.png`

### Continuation browser E2E

A second focused browser pass verified the new customer tracking, Driver portal, drawn e-signature, and Admin clear-rate control:

17/17 checks passed:

1. `/orders` redirects unauthenticated visitors to `/login?next=/orders`.
2. Login exposes “Track my orders” and “Driver portal”.
3. Admin demo sign-in.
4. Temporary transport rate set.
5. PENDING order created.
6. `ACCEPTED → PREPARING → READY`.
7. Driver assigned and order dispatched.
8. `/driver` shows the dispatched order.
9. Drawn canvas e-signature captured as PNG data URI.
10. Driver portal records `DELIVERED` with signature and matching cash.
11. `/pos` settles the order to `CLOSED`.
12. Admin “Clear rate” returns billing to unconfigured.
13. Customer sees the closed order timeline at `/orders`.
14. Driver role sees the recently closed assignment at `/driver`.
15. Protected-route and role redirects work.
16. Browser console errors: **none**.
17. Unexpected failed network requests: **none**.

The drawn signature is stored directly in `delivery_signature_url`; no external storage bucket was needed for verification.

### Complete-module browser E2E

11/11 checks passed on the rebuilt production preview:

1. Catalog detail modal shows ingredients, macro progress bars, and adds to the global cart.
2. COD checkout creates a PENDING order as the demo customer.
3. `/orders` renders simulated live location, ETA, and return messages.
4. `/bill/[orderId]` renders the digital e-bill and Print KOT / Print Bill actions.
5. Admin can enter `/admin` and see the Omnipotent Master Admin control dashboard.
6. Employees view renders employee management.
7. Financials view renders provisional P&L and CSV export.
8. Documents view renders e-bill sharing and thermal print actions.
9. Master Admin quick control dispatches the order.
10. Driver portal renders the Google Maps placeholder and final e-bill.
11. No browser console errors or unexpected failed network requests.

Screenshots `11`–`15` capture the new customer, Admin, tracking, e-bill, and document flows.

### Remote Supabase SQL lifecycle test

A full lifecycle was also run directly against the connected project through the connector, independent of the sandbox network block:

| Field | Result |
| --- | --- |
| Test order | `d50e77af-a2d2-41b0-8dae-c5c1a0deadbb` |
| Final status | `CLOSED` |
| Transport cost | `1.00` |
| Final total | `1.00` |
| Status history rows | 7 |
| Audit events | 2 |
| Per-km rate after test | `null` (cleared) |

A temporary test rate of `1.00/km` with `2.00 km` free was used only to exercise dynamic billing. The remote rate was reset to `null`; no business rate is stored.

The Admin-only `macrobox_pos.clear_transport_rate()` RPC from migration `202610270004_pos_clear_transport_rate.sql` was also applied and verified remotely: an Admin can set and then clear a test rate, a Driver is blocked with `TRANSPORT_RATE_ADMIN_ONLY`, and the final remote `per_km_rate` is `null`.

Migration `202610270005_public_menu_read.sql` was applied and verified remotely: `macrobox_pos.products` and `macrobox_pos.categories` now expose `public_menu_read_*` policies to `anon`, scoped to `is_active = true`. The existing `app_users_admin_write` policy remains in place for Admin employee updates.

---

## 8. Important caveats

- No real prices, nutrition values, addresses, salary values, or health claims were invented. `0.00` product prices are placeholders.
- The supplied logo lockup is used unchanged.
- The exact contact line and promotional copy rules from the original brief still apply to social/marketing assets; the POS UI does not add new health claims.
- Demo accounts are verification-only.
- The new “Macribox” project ref you supplied was not visible to the connected Supabase account. If you want the app pointed at that project, reconnect Supabase or provide the correct ref/URL; the code is ready for it.

---

## 9. Quick commands

```bash
npm install
npm run dev            # http://localhost:3000
npm run typecheck
npm run build
npm run start
npm run test:pos
```
