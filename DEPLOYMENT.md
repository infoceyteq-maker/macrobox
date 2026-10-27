# MacroBox production deployment

## Live surfaces

Canonical production origin: `https://macrobox-pos-live.vercel.app`

| Surface | URL | Authentication |
| --- | --- | --- |
| Customer digital menu | `https://macrobox-pos-live.vercel.app/` | Public browsing |
| Customer registration | `https://macrobox-pos-live.vercel.app/customer/register` | Email + E.164 phone + password |
| Customer sign-in | `https://macrobox-pos-live.vercel.app/customer/login` | Email **or** phone + password |
| Master Admin login | `https://macrobox-pos-live.vercel.app/admin/login` | Pre-provisioned Admin only; no registration |
| Master Admin panel | `https://macrobox-pos-live.vercel.app/admin` | `ADMIN` |
| Front Desk / POS login | `https://macrobox-pos-live.vercel.app/frontdesk/login` | `ADMIN`, `MANAGER`, `FRONT_DESK`, `KITCHEN` |
| POS dashboard | `https://macrobox-pos-live.vercel.app/pos` | Non-customer staff |
| Driver login | `https://macrobox-pos-live.vercel.app/driver/login` | `DRIVER`, `ADMIN` |
| Driver portal | `https://macrobox-pos-live.vercel.app/driver` | `DRIVER`, `ADMIN` |
| Order tracking | `https://macrobox-pos-live.vercel.app/orders` | Signed-in customers and staff |
| Digital e-bill | `https://macrobox-pos-live.vercel.app/bill/[orderId]` | Signed-in, RLS-scoped |

The public catalog, cart, customer authentication, and staff authentication are separate route families. `proxy.ts` refreshes the Supabase session and reads the active `app_users.role` before permitting `/admin`, `/pos`, `/driver`, `/orders`, and `/bill`. Database RLS remains authoritative.

## Deployment record

- GitHub PR: `https://github.com/infoceyteq-maker/macrobox/pull/1` (merged into `main`).
- Production commit: `b6261ac7042be489753f28babcefbcfcdeb0a215`.
- Vercel project: `macrobox-pos-live` (`prj_LrbnqyK2AQIcVEc5CY1bEWnCplSH`).
- Production deployment: `dpl_6bcXQ56vmTXF7UJ2xbDE69ZABhgw`, state `READY`, promoted to the production alias.
- Non-secret runtime health check: `https://macrobox-pos-live.vercel.app/api/auth-health`.

## Supabase Data API

The POS tables remain in the isolated `macrobox_pos` schema. `202610270008_expose_pos_api_schema.sql` adds that schema to the Supabase-hosted PostgREST `pgrst.db_schemas` setting while preserving `public`, `storage`, and `graphql_public`, then reloads PostgREST config and schema cache. Without this exposure, the app returns `Invalid schema: macrobox_pos`; RLS and explicit grants still control access.

`/api/auth-health` verifies from the Vercel runtime that the server-only service-role key can reach both the Supabase Auth Admin API and the isolated-schema phone-lookup RPC.

## Supabase Auth

- Customers register with both an email address and an international phone number.
- `app/actions/customer-auth.ts` uses the server-only `SUPABASE_SERVICE_ROLE_KEY` to call `auth.admin.createUser` with `email_confirm` and `phone_confirm`. No verification email or SMS provider is required for this controlled password-based flow.
- The 202610270006 and 202610270007 migrations copy the supplied phone into `macrobox_pos.app_users`, enforce digits-only phone uniqueness, and expose a service-role-only phone-to-email resolver.
- Sign-in first uses native Supabase email/password or phone/password. If a project rejects direct phone/password sign-in, the Server Action resolves the confirmed phone to its Auth email through the service-role RPC and retries.
- Email and phone sign-in, and the Master Admin password sign-in, were smoke-tested against the live GoTrue `/token` endpoint.
- Supabase Auth `site_url` and redirect allow-list include the production Vercel origin and Vercel preview patterns.

## Master Admin

The pre-provisioned Master Admin email is `admin@macrobox.com`. Its one-time initial password is delivered only in the deployment handoff, not committed to this repository. Rotate it immediately after first login. The six verification-only `@macrobox.local` accounts were suspended in the production database.

No Admin or staff self-registration page exists. Additional employees must be provisioned by the Master Admin through a controlled process.

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

The deployment continues to use the isolated `macrobox_pos` schema on the connected Umbrellacafe Supabase project. The unrelated legacy `public.orders` rows are untouched. Product prices are still `0.00` placeholders and the transport rate remains unconfigured until the business supplies approved values.

## Post-deployment checklist

1. Rotate the initial Master Admin password.
2. Configure the approved product prices and transport rate in the Admin panel.
3. Replace the simulated driver map with an approved map/GPS provider.
4. Add verified salary/expense and nutrition data before publishing derived claims.
5. Enable CAPTCHA and email/phone verification when a production mailer/SMS provider is available.
