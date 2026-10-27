# MacroBox POS — final handover

## Repository

- GitHub: https://github.com/infoceyteq-maker/macrobox
- Final working branch: `arena/16fb665c-macrobox`
- Base branch: `main`

## Live URLs

- Customer UI: https://macrobox-pos-live.vercel.app/
- Customer phone OTP sign-in / registration: https://macrobox-pos-live.vercel.app/customer/login
- Customer profile: https://macrobox-pos-live.vercel.app/profile
- Master Admin login: https://macrobox-pos-live.vercel.app/admin/login
- Master Admin panel after login: https://macrobox-pos-live.vercel.app/admin
- Driver login: https://macrobox-pos-live.vercel.app/driver/login
- Front Desk / POS login: https://macrobox-pos-live.vercel.app/frontdesk/login
- Runtime health check: https://macrobox-pos-live.vercel.app/api/auth-health

## Credentials

Master Admin, Driver, and Front Desk one-time passwords are delivered only in the
private deployment handoff. They are intentionally not committed to this
repository. Rotate them after first login.

## Production notes

- Customer authentication is passwordless: phone OTP is primary and email magic
  link is optional.
- A real SMS provider must be configured in the Supabase Auth dashboard for live
  SMS delivery. Provider credentials are not stored here or in Vercel.
- Product meal prices remain `0.00` placeholders until approved business values
  are supplied.
- The approved LKR distance-tiered transport rate is active.
- Driver map remains a clearly labelled placeholder until a real mapping/GPS
  provider is approved.

## Validation

- `npm run typecheck`
- `npm run build`
- `npm run test:pos`
- Browser E2E for customer OTP flow and public-UI isolation
- Live `/api/auth-health` check
