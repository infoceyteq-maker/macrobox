# MacroBox production deployment

Final links and handover notes are also summarized in `FINAL_HANDOVER.md`.

## Live surfaces

Canonical production origin: `https://macrobox-pos-live.vercel.app`

| Surface | URL | Authentication |
| --- | --- | --- |
| Customer digital menu | `https://macrobox-pos-live.vercel.app/` | Public browsing; no internal system links |
| Customer sign-in | `https://macrobox-pos-live.vercel.app/customer/login` | WhatsApp OTP only; verification auto-creates the customer profile and redirects to Profile |
| Customer profile | `https://macrobox-pos-live.vercel.app/profile` | Signed-in customer; optional name, address, email magic link |
| Master Admin login | `https://macrobox-pos-live.vercel.app/admin/login` | Pre-provisioned Admin only; no registration |
| Master Admin panel | `https://macrobox-pos-live.vercel.app/admin` | `ADMIN` |
| Front Desk / POS login | `https://macrobox-pos-live.vercel.app/frontdesk/login` | `ADMIN`, `MANAGER`, `FRONT_DESK`, `KITCHEN` |
| POS dashboard | `https://macrobox-pos-live.vercel.app/pos` | Non-customer staff |
| Driver login | `https://macrobox-pos-live.vercel.app/driver/login` | `DRIVER`, `ADMIN` |
| Driver portal | `https://macrobox-pos-live.vercel.app/driver` | `DRIVER`, `ADMIN` |
| Order tracking | `https://macrobox-pos-live.vercel.app/orders` | Signed-in customers and staff |
| Digital e-bill | `https://macrobox-pos-live.vercel.app/bill/[orderId]` | Signed-in, RLS-scoped |

The public catalog, cart, customer authentication, customer profile, and staff authentication are separate route families. `proxy.ts` refreshes the Supabase session and reads the active `app_users.role` before permitting `/admin`, `/pos`, `/driver`, `/orders`, `/bill`, and `/profile`. Public customer pages expose only customer-relevant links; Admin/Staff/POS/Driver links are not rendered in the customer UI. Database RLS remains authoritative.

## Deployment record

- GitHub PRs: [#1](https://github.com/infoceyteq-maker/macrobox/pull/1), [#2](https://github.com/infoceyteq-maker/macrobox/pull/2), [#3](https://github.com/infoceyteq-maker/macrobox/pull/3), [#4](https://github.com/infoceyteq-maker/macrobox/pull/4), [#5](https://github.com/infoceyteq-maker/macrobox/pull/5), and [#6](https://github.com/infoceyteq-maker/macrobox/pull/6) (all merged into `main`).
- Final production commit: `38ae22d76a4f6d5aab9b1b562d674fbebc9688b0`.
- Vercel project: `macrobox-pos-live` (`prj_LrbnqyK2AQIcVEc5CY1bEWnCplSH`).
- Final production deployment: `dpl_DE74vfDqKGwXi3VKgEkUfzRuG2jv`, state `READY`, promoted to the production alias.
- Non-secret runtime health check: `https://macrobox-pos-live.vercel.app/api/auth-health` — returns `ok:true`, `supabaseAdminApi:true`, `phoneLookupRpc:true`, `schema:"macrobox_pos"`, `mode:"supabase"`.

## Supabase Data API

The POS tables remain in the isolated `macrobox_pos` schema. `202610270008_expose_pos_api_schema.sql` adds that schema to the Supabase-hosted PostgREST `pgrst.db_schemas` setting while preserving `public`, `storage`, and `graphql_public`, then reloads PostgREST config and schema cache. Without this exposure, the app returns `Invalid schema: macrobox_pos`; RLS and explicit grants still control access.

`/api/auth-health` verifies from the Vercel runtime that the server-only service-role key can reach both the Supabase Auth Admin API and the isolated-schema phone-lookup RPC.

## Supabase Auth

- Customers use **passwordless WhatsApp OTP** as the only customer sign-in. `sendCustomerWhatsAppOtpAction()` calls Supabase `signInWithOtp({ phone, channel: 'whatsapp' })`; `verifyCustomerWhatsAppOtpAction()` calls `verifyOtp({ phone, token, type: 'sms' })` (Supabase verifies phone OTPs with the `sms` type even when delivery is WhatsApp) and creates the session.
- The same flow registers new customers automatically. No password, name, email, or delivery address is collected upfront.
- After verification, `ensureCustomerProfileForUser()` calls the service-role RPC `ensure_customer_profile()` so a `CUSTOMER` row exists in `macrobox_pos.app_users` before the first authenticated query.
- Customers are redirected to `/profile`, where they can optionally add Name, Delivery Address, Delivery Notes, and an Email. `update_customer_profile()` is a customer-scoped RPC that cannot change role, status, salary, or another user's row.
- Optional email verification uses `supabase.auth.updateUser({ email }, { emailRedirectTo })`. `/auth/callback` exchanges the PKCE code or token hash, syncs the profile, and returns to `/profile`.
- The 202610270010 migration adds `delivery_address`, `delivery_notes`, `profile_completed_at`, the profile RPCs, and an Auth-user update trigger.
- The local PGlite preview uses a fixed OTP `123456`; no real WhatsApp message is sent in preview.
- **Production WhatsApp requirement:** Supabase Auth Phone must have a WhatsApp-capable sender configured. Supabase documents the WhatsApp channel for Twilio WhatsApp senders; provider credentials/sender details are configured in Supabase/Twilio, never stored in this repository or Vercel. Without that configuration, `signInWithOtp` returns a provider error and the UI surfaces a setup message instead of inventing a code.
- Supabase Auth `site_url` and redirect allow-list include the production Vercel origin, `/auth/callback`, and Vercel preview patterns.

## Master Admin

The pre-provisioned Master Admin email is `admin@macrobox.com`. Its one-time initial password is delivered only in the deployment handoff, not committed to this repository. Rotate it immediately after first login. The six verification-only `@macrobox.local` accounts were suspended in the production database.

No Admin or staff self-registration page exists. Additional employees must be provisioned by the Master Admin through a controlled process.

Production Driver and Front Desk accounts were provisioned out-of-band for lifecycle testing; their one-time passwords are delivered only in the deployment handoff, not committed to this repository. Rotate both after first login.

## Vercel environment variables

Configured for production, preview, and development:

- `NEXT_PUBLIC_SUPABASE_URL` — plain, public.
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` — plain, public.
- `NEXT_PUBLIC_SUPABASE_SCHEMA=macrobox_pos` — plain, public.
- `NEXT_PUBLIC_POS_LIVE_MODE=supabase` — plain, public.
- `NEXT_PUBLIC_SITE_URL` — plain, public.
- `SUPABASE_SERVICE_ROLE_KEY` — **sensitive**, encrypted by Vercel, server-only.

No `POS_DEMO_PASSWORD` or demo sign-in flag is configured in production. One-click demo actions are rejected server-side and hidden from production UI.

## Database safety

The deployment continues to use the isolated `macrobox_pos` schema on the connected Umbrellacafe Supabase project. The unrelated legacy `public.orders` rows are untouched. Product prices are still `0.00` placeholders and no meal price has been invented. The approved LKR distance-tiered transport rate is active: LKR 150 for 0–3 km, +120 for the 4th km, +100 for the 5th km, and +60 per km beyond 5 km.

## Post-deployment checklist

1. Rotate the initial Master Admin password.
2. Configure the approved product prices in the Admin panel; `0.00` still blocks real charging assumptions.
3. Replace the simulated driver map with an approved map/GPS provider.
4. Add verified salary/expense and nutrition data before publishing derived claims.
5. Configure the production Twilio WhatsApp sender/credentials in Supabase Auth so live WhatsApp OTP messages are delivered, then test with a real Sri Lankan WhatsApp number.
6. Enable CAPTCHA and production mailer settings when available.
