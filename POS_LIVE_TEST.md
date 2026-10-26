# MacroBox POS — Live Setup & Verification

## Status: live and tested

- Production build runs on **port 3000** in the Arena preview.
- Catalog: `/`
- Staff login: `/login`
- Unified Admin/POS dashboard: `/pos`
- “Staff / POS →” link on the catalog opens the portal.

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
  - Delivery e-signature reference, distance, cash collection with expected total.
  - Cash settlement to `CLOSED`.
  - New order form with product quantities and price-pending labels.
  - Menu admin: price edit, visibility, category/product create/update.
  - Transport settings with the exact `max(distance - freeDistance, 0) × rate` formula.
  - Status history and audit events.
  - Role-aware tabs and sign-out.
- `proxy.ts` — refreshes Supabase auth or checks the local session cookie; protects `/pos`.
- `app/page.tsx` — catalog plus “Staff / POS →” link.

Driver RBAC was browser-tested: a Driver cannot see the Admin transport form or the New order tab.

---

## 7. Verification results

### Code checks

```bash
npm run typecheck   # PASS
npm run build       # PASS
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
- Driver blocked from Admin category creation.

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
