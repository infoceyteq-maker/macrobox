# MacroBox — implemented module map

This map shows the customer, admin, driver, billing, print, and notification layers added to the original Next.js catalog.

```text
app/
  actions/
    auth.ts                    # local/Supabase sign-in, demo roles, sign-out
    employees.ts               # Admin-only employee profile/role/status updates
    pos.ts                     # orders, lifecycle, transport, menu, delivery, settlement
    public-menu.ts             # anonymous active-menu read for cart/catalog
  bill/
    [orderId]/page.tsx         # protected digital e-bill route
    page.tsx                   # redirects to /orders
  cart/page.tsx                # full COD checkout page
  admin/page.tsx               # Omnipotent Master Admin route (ADMIN only)
  driver/page.tsx              # mobile-optimised Driver portal
  orders/page.tsx              # customer tracking page
  pos/page.tsx                 # unified POS dashboard
  login/page.tsx               # branded sign-in + demo roles
  layout.tsx                   # fonts, global ToastProvider, CartProvider
  globals.css                  # Soft UI primitives + 80mm thermal @media print

components/
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
```

## Design enforcement

- Sage `#DCE6DA`, interactive greens `#8FBC8F` / `#7CA982`, cream `#F7F6F2`, charcoal `#2E3033`.
- Cards/buttons/inputs use raised or inset extruded shadows from `components/ui/neu.ts` and `app/globals.css`.
- Print output is black-and-white, 80mm, shadow-free, and isolated with `.thermal-print`.
- No real prices, rates, salaries, addresses, health claims, or Google Maps key were invented.
- `0.00` remains a “price pending” placeholder; Admin must enter approved values before production.
