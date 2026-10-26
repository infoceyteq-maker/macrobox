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

## POS backend (schema + Server Actions)

The backend-only POS/Restaurant Management layer is documented in `POS_BACKEND.md`. It adds:

- `supabase/migrations/202610270001_pos_core.sql` — strict Supabase/PostgreSQL schema, RLS, order state machine, driver assignment, transport billing, and audit tables.
- `app/actions/pos.ts` — typed Next.js Server Actions for orders, lifecycle transitions, delivery, cash settlement, transport rate, and catalog visibility.
- `lib/pos/*` — shared types, schemas, Supabase server client, and the mirrored transition/transport helpers.

No POS frontend UI has been added, and the existing catalog UI is unchanged.
