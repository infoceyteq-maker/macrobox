# MacroBox — Lunch (Rice & Curry) Catalog

A mobile-first, neumorphic Next.js product catalog and animated detail view for the supplied MacroBox weekday lunch data, with a deeper sage surface, exact `#8FBC8F` / `#7CA982` interactive accents, complete Monday–Friday ingredient and macro details, dedicated meal imagery, and a typed update layer for uploaded dishes.

## Run locally

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run typecheck
npm run build
npm run start
```

The main component is `components/LunchCatalog.tsx`. It is rendered by `app/page.tsx`.

## Meal imagery

The component uses the supplied `imagePlaceholder` paths verbatim. Five distinct, high-end photorealistic 3D meal-bowl images are already integrated into `public/images/` and appear in both the catalog cards and the detail view:

- `monday-bowl.jpg`
- `tuesday-bowl.jpg`
- `wednesday-bowl.jpg`
- `thursday-bowl.jpg`
- `friday-bowl.jpg`

Replace those files at the same paths if final food photography becomes available. If an image is missing or fails to load, the component shows a built-in neumorphic plate fallback. The supplied primary MacroBox logo artwork is used unchanged in `public/macrobox_primary_cutout.png`.

## Brand accents

Interactive surfaces, active weekday buttons, focus rings, icons, checkmarks, progress indicators, and pressed states use the exact brand greens `#8FBC8F` and `#7CA982`. Raised elements keep soft extruded shadows; active/pressed states use inset shadows.

## Dynamic curry / ingredient updates

`lunchMenu` remains the verified base data. `LunchCatalog` merges optional updates from three integration points:

- the `mealUpdates` prop, keyed by weekday id (`mon`, `tue`, `wed`, `thu`, `fri`);
- the exported empty `uploadedMealUpdates` placeholder map in `components/LunchCatalog.tsx`;
- the `macrobox:meal-updates` window `CustomEvent`, dispatched through the exported `publishMealUpdates()` helper.

Each `MealUpdate` can override `day`, `title`, `imagePlaceholder`, `ingredients`, `customDishes`, and `macros`. Use `ingredients` to replace the complete list, or `customDishes` to append/replace individual dishes (with the optional `replaces` field). Partial `macros` updates merge with the supplied values. Both the catalog cards and the open detail view re-render from the merged data, including the corresponding food image.

No backend or upload UI is hard-coded because storage and upload-flow details were not supplied; the prop and event layer is the intended integration boundary.

## Data note

`lunchMenu` in the component preserves all supplied ingredients and macro values verbatim. Nutrition and health-related values should be substantiated and reviewed before publication. In particular, the Wednesday carbs/fat values appear inconsistent with its calorie value, but have intentionally not been changed here.

## POS backend + live Admin UI

The POS/Restaurant Management layer is documented in `POS_BACKEND.md`; live setup, credentials, and verification results are in `POS_LIVE_TEST.md`. It adds:

- `supabase/migrations/202610270001_pos_core.sql` — strict Supabase/PostgreSQL schema, RLS, order state machine, driver assignment, transport billing, and audit tables.
- `supabase/migrations/202610270002_pos_isolated_schema.sql` — applies the core schema into `macrobox_pos` on the connected project without touching legacy `public.orders`.
- `supabase/migrations/202610270003_pos_ui_directory_rpcs.sql` — read-only Driver/Customer directory RPCs for the dashboard.
- `supabase/migrations/202610270004_pos_clear_transport_rate.sql` — Admin-only clear-rate RPC for both schema layouts.
- `app/actions/pos.ts`, `app/actions/auth.ts` — typed Server Actions for orders, lifecycle transitions, delivery, cash settlement, transport rate / clear-rate, catalog writes, and login.
- `app/login/page.tsx`, `app/pos/page.tsx`, `components/PosDashboard.tsx` — branded login and unified Admin/POS dashboard.
- `components/SignaturePad.tsx` — real drawn e-signature capture stored as PNG delivery evidence.
- `app/orders/page.tsx`, `components/CustomerOrders.tsx` — protected customer order tracking with live status timeline.
- `app/driver/page.tsx`, `components/DriverPortal.tsx` — focused Driver/Admin delivery portal with expected cash and signature capture.
- `lib/pos/*` — shared types, Zod schemas, Supabase clients, local PGlite live engine, and mirrored transition/transport helpers.
- `scripts/pos-local-test.ts` — automated SQL-level lifecycle test (`npm run test:pos`).

The catalog remains at `/`; “Track my orders →” opens `/orders` and “Staff / POS →” opens `/login` and `/pos`. Drivers and Admins can also use `/driver`.

## Complete module layer

The full implementation map is in `docs/FOLDER_STRUCTURE.md`. Key additions:

- `/cart` — neumorphic cart drawer + full Cash-on-Delivery checkout.
- `/admin` — Omnipotent Master Admin dashboard with incoming-order quick control, employee management, provisional P&L, menu visibility, e-bills, and KOT printing.
- `/driver` — mobile-optimised assigned orders, Google Maps placeholder, dynamic final e-bill, drawn signature, and “Delivered & Cash Collected”.
- `/orders` — simulated live driver location, ETA, return messages, and status timeline.
- `/bill/[orderId]` — shareable digital e-bill with 80mm thermal print output.
- Global `sonner` toasts for New Order Received, Order Accepted, Order Dispatched, Payment Settled, and other return messages.
- `supabase/migrations/202610270005_public_menu_read.sql` — anonymous RLS read for active menu items only; no prices or private order data are exposed.
- `supabase/migrations/202610270009_tiered_transport_rate.sql` — approved LKR distance-tiered transport billing and Admin activation RPC.
- `supabase/migrations/202610270010_customer_profile_otp.sql` — passwordless customer profile fields, OTP provisioning RPC, and customer-only profile update RPC.
- `supabase/migrations/202610270011_lead_registration.sql` — registration lead capture: Auth metadata name/city are written into the auto-created customer profile (the unverified lead email stays in Auth metadata only).

Print rules are in `app/globals.css`: `@page { size: 80mm auto; margin: 0; }` plus black-and-white, shadow-free `.thermal-print` output. The approved LKR distance-tiered transport rate is implemented in `lib/pos/transport.ts` and the authoritative SQL function; no real meal prices, salaries, Google Maps key, or health claims were invented. Product `0.00` still means “price pending” until the business supplies approved prices.

## Production authentication and routes

- Public customer menu: `/`; cart: `/cart`.
- Customer registration: `/customer/register` (lead form — name, phone, optional email and delivery city — then SMS OTP; verification auto-creates the profile and continues to the menu). Returning customer sign-in: `/customer/login` (passwordless phone OTP; alternative email-code sign-in at `/customer/email-login`, quick name/phone OTP sign-in at `/customer/quick-login`, then one optional step to link an email (verified magic link) and/or a Google identity via Supabase `linkIdentity` — Google requires the Google provider and manual linking enabled in Supabase Auth; both are skippable, and the generic `/login` route remains employee-only). `/menu` redirects to `/`.
- Customer profile: `/profile` (optional name, delivery address, notes, and email magic link).
- Customer tracking: `/orders`; digital e-bill: `/bill/[orderId]`.
- Master Admin login: `/admin/login` (no self-registration); panel: `/admin`.
- Front Desk / POS login: `/frontdesk/login`; dashboard: `/pos`.
- Driver login: `/driver/login`; portal: `/driver`.
- Generic employee login: `/login`.

Public customer pages render only customer-relevant navigation. Admin/Staff/POS/Driver links are not exposed in the customer UI. `proxy.ts` refreshes Supabase Auth cookies and uses the active database role to separate customer and employee surfaces. The service-role key is used only in server-side OTP profile provisioning and email-link callbacks; it is never exposed as `NEXT_PUBLIC_*`. See `DEPLOYMENT.md` for live links, Vercel environment variables, and the production SMS-provider requirement.
