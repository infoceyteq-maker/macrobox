# MacroBox — implemented module map

This map shows the customer, admin, driver, billing, print, and notification layers added to the original Next.js catalog.

```text
app/
  actions/
    auth.ts                    # local/Supabase staff sign-in, sign-out
    customer-auth.ts           # WhatsApp OTP send/verify + legacy server auth actions
    customer-profile.ts        # customer profile update + optional email magic link
    employees.ts               # Admin-only employee profile/role/status updates
    pos.ts                     # orders, lifecycle, tiered transport activation, menu, delivery, settlement
    public-menu.ts             # anonymous active-menu read for cart/catalog
  bill/
    [orderId]/page.tsx         # protected digital e-bill route
    page.tsx                   # redirects to /orders
  cart/page.tsx                # full COD checkout page
  admin/page.tsx               # Omnipotent Master Admin route (ADMIN only)
  driver/page.tsx              # mobile-optimised Driver portal
  orders/page.tsx              # customer tracking page
  pos/page.tsx                 # unified POS dashboard
  login/page.tsx               # generic employee sign-in (no registration)
  customer/login/page.tsx      # Baduma.sl WhatsApp OTP sign-in (auto-creates profile)
  customer/register/page.tsx   # redirects to WhatsApp OTP sign-in
  customer/quick-login/page.tsx # redirects to WhatsApp OTP sign-in
  customer/email-login/page.tsx # redirects to WhatsApp OTP sign-in
  profile/page.tsx             # optional customer profile management
  auth/callback/route.ts       # email magic-link / token_hash callback
  admin/login/page.tsx         # Master Admin login (ADMIN only)
  driver/login/page.tsx        # Driver login (DRIVER/ADMIN)
  frontdesk/login/page.tsx     # Front Desk / POS login
  layout.tsx                   # fonts, global ToastProvider, CartProvider
  globals.css                  # Soft UI primitives + 80mm thermal @media print

components/
  auth/
    WhatsAppOtpLogin.tsx       # dark neumorphic WhatsApp OTP UI, customer links only
    StaffLoginForm.tsx         # role-specific employee login, no self-registration
  customer/
    CustomerProfile.tsx        # optional name/address/email profile management
  LunchCatalog.tsx             # Monday–Friday cards, detail modal, macro progress, add-to-cart
  PosDashboard.tsx             # master control, orders, menu, employees, financials, documents
  CustomerOrders.tsx           # customer order list + tracking timeline
  DriverPortal.tsx             # assigned orders, map placeholder, dynamic e-bill, signature
  SignaturePad.tsx             # functional canvas e-signature
  PortalShell.tsx (layout/)    # shared branded customer/billing shell
  cart/
    cart-context.ts            # typed cart context + safe fallback
    CartProvider.tsx           # localStorage cart, public menu sync, cart FAB
    CartDrawer.tsx             # neumorphic cart drawer
    CartCheckout.tsx           # COD checkout flow
  admin/
    MasterOrderControl.tsx     # Admin quick accept/preparing/ready/dispatch
    EmployeesPanel.tsx         # employee role/status/profile management
    FinancialsPanel.tsx        # provisional P&L + CSV export
  billing/
    EBill.tsx                  # neumorphic digital invoice + share/copy
    ThermalReceipt.tsx         # print-only 80mm KOT / bill
    OrderDocuments.tsx         # order selector, e-bill, Print KOT, Print Bill
  tracking/
    RouteMap.tsx               # animated simulated route (no GPS claim)
    TrackingMap.tsx            # customer ETA, return messages, e-bill link
    DeliveryMapPlaceholder.tsx # Google Maps integration placeholder for drivers
  ui/
    neu.ts                     # shared Soft UI tokens/helpers
    ToastProvider.tsx          # global sonner toast layer

lib/
  brand.ts                     # exact supplied palette + contact line
  ui/toast.ts                  # notify() wrapper for return messages
  pos/
    customer-auth.ts           # OTP/email/profile schemas and phone helpers
    customer-profile.ts        # server-only OTP profile provisioning helper
    supabase-admin.ts          # server-only service-role client factory
    public-menu.ts             # public menu types + price-pending helper
    action-result.ts           # shared ActionResult wrapper
    local-db.ts                # PGlite engine + public menu + employee update
    schemas.ts                 # Zod validation, including employee updates
    ...                        # existing config, dashboard, types, transport, etc.

supabase/migrations/
  202610270001_pos_core.sql
  202610270002_pos_isolated_schema.sql
  202610270003_pos_ui_directory_rpcs.sql
  202610270004_pos_clear_transport_rate.sql
  202610270005_public_menu_read.sql  # anon-active-menu RLS for public/macrobox_pos
  202610270006_customer_auth.sql     # phone-aware Auth profile trigger + lookup RPC
  202610270007_customer_phone_normalization.sql # digits-only E.164 phone matching
  202610270008_expose_pos_api_schema.sql # Supabase PostgREST profile exposure
  202610270009_tiered_transport_rate.sql  # approved LKR distance tiers + calculator
  202610270010_customer_profile_otp.sql  # passwordless OTP profiles + customer profile RPCs
```

## Production routing

- Customer: `/`, `/cart`, `/customer/login`, `/profile`, `/orders`, `/bill/[orderId]`, `/auth/callback`. `/customer/register`, `/customer/quick-login`, and `/customer/email-login` redirect to `/customer/login`.
- Master Admin: `/admin/login` → `/admin`.
- Front Desk / POS: `/frontdesk/login` → `/pos`.
- Driver: `/driver/login` → `/driver`.
- Generic employee fallback: `/login` → `/pos`.

`proxy.ts` excludes auth pages from protected-prefix matching, refreshes Supabase cookies, and consults `app_users.role/status` before allowing a protected route. See `DEPLOYMENT.md` for the live Vercel surfaces and environment variables.

## Design enforcement

- Sage `#DCE6DA`, interactive greens `#8FBC8F` / `#7CA982`, cream `#F7F6F2`, charcoal `#2E3033`.
- Cards/buttons/inputs use raised or inset extruded shadows from `components/ui/neu.ts` and `app/globals.css`.
- Print output is black-and-white, 80mm, shadow-free, and isolated with `.thermal-print`.
- The approved LKR distance-tiered transport rate is implemented exactly in `lib/pos/transport.ts` and SQL. No real meal prices, salaries, addresses, health claims, or Google Maps key were invented.
- Product `0.00` remains a “price pending” placeholder; Admin must enter approved values before production.
- Public customer navigation contains only Menu, Cart, Track Orders, and Profile. Master Admin, Staff/POS, Kitchen, and Driver routes are not linked from customer pages and remain direct-URL, role-protected surfaces.
- The Baduma.sl WhatsApp login surface uses a scoped dark neumorphic treatment: near-black background, #FACC15/#FFD700 yellow actions, layered extruded/inset shadows, and no customer password or upfront registration form.
