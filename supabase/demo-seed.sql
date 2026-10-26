-- MacroBox POS demo seed — verification only, not a production migration.
-- Run AFTER 202610270001_pos_core.sql (or the isolated-schema variant).
-- It creates six role accounts, five weekday categories, and five products
-- using the exact supplied catalog copy. Product prices are 0.00 placeholders;
-- no real price, nutrition value, address, or health claim is invented.
--
-- Demo password for every account: MacroBox@2026!
-- Replace or disable these accounts before production use.

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Demo Auth users
-- ---------------------------------------------------------------------------

with seed(email, name) as (
  values
    ('admin@macrobox.local', 'MacroBox Admin'),
    ('manager@macrobox.local', 'MacroBox Manager'),
    ('frontdesk@macrobox.local', 'MacroBox Front Desk'),
    ('kitchen@macrobox.local', 'MacroBox Kitchen'),
    ('driver@macrobox.local', 'MacroBox Driver'),
    ('customer@macrobox.local', 'MacroBox Customer')
),
new_users as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password,
    email_confirmed_at, raw_app_meta_data, raw_user_meta_data,
    created_at, updated_at, is_sso_user, is_anonymous,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    reauthentication_token, email_change_token_current, email_change_confirm_status
  )
  select
    '00000000-0000-0000-0000-000000000000'::uuid,
    gen_random_uuid(),
    'authenticated',
    'authenticated',
    s.email,
    crypt('MacroBox@2026!', gen_salt('bf')),
    now(),
    jsonb_build_object('provider', 'email', 'providers', array['email']),
    jsonb_build_object('name', s.name),
    now(), now(),
    false, false,
    '', '', '', '', '', '', 0
  from seed s
  where not exists (select 1 from auth.users u where lower(u.email) = lower(s.email))
  returning id, email
),
new_identities as (
  insert into auth.identities (provider_id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
  select
    u.id::text,
    u.id,
    jsonb_build_object(
      'sub', u.id::text,
      'email', u.email,
      'email_verified', true,
      'phone_verified', false,
      'provider', 'email'
    ),
    'email',
    now(), now(), now()
  from new_users u
  where not exists (select 1 from auth.identities i where i.user_id = u.id and i.provider = 'email')
  returning user_id
)
select count(*) as users_created from new_users;

-- On a fresh project the trigger creates CUSTOMER rows. Promote staff.
-- For the isolated macrobox_pos schema, change `public.app_users` below to
-- `macrobox_pos.app_users` and cast to `macrobox_pos.app_role`.
update public.app_users au
set role = s.pos_role::public.app_role,
    name = s.display_name,
    status = 'ACTIVE'::public.employee_status
from (values
  ('admin@macrobox.local', 'ADMIN', 'MacroBox Admin'),
  ('manager@macrobox.local', 'MANAGER', 'MacroBox Manager'),
  ('frontdesk@macrobox.local', 'FRONT_DESK', 'MacroBox Front Desk'),
  ('kitchen@macrobox.local', 'KITCHEN', 'MacroBox Kitchen'),
  ('driver@macrobox.local', 'DRIVER', 'MacroBox Driver'),
  ('customer@macrobox.local', 'CUSTOMER', 'MacroBox Customer')
) as s(email, pos_role, display_name)
join auth.users u on lower(u.email) = lower(s.email)
where au.id = u.id;

-- ---------------------------------------------------------------------------
-- Exact supplied weekday catalog (0.00 = price not supplied)
-- For the isolated macrobox_pos schema, replace `public.categories` /
-- `public.products` with `macrobox_pos.categories` / `macrobox_pos.products`.
-- ---------------------------------------------------------------------------

with seed(name, slug, sort_order) as (
  values
    ('Monday', 'monday', 1),
    ('Tuesday', 'tuesday', 2),
    ('Wednesday', 'wednesday', 3),
    ('Thursday', 'thursday', 4),
    ('Friday', 'friday', 5)
),
inserted as (
  insert into public.categories (name, slug, description, sort_order, is_active)
  select s.name, s.slug, null, s.sort_order, true
  from seed s
  where not exists (select 1 from public.categories c where c.slug = s.slug)
  returning id
)
select count(*) as categories_created from inserted;

with seed(day_slug, title, ingredients, macros) as (
  values
    ('monday', 'MacroBox - Healthy Foods',
      $j$[{"name":"Basmathi rice","amount":"100g"},{"name":"Dhal curry","amount":"75g"},{"name":"Black pepper chicken","amount":"100g"},{"name":"Eggs","amount":"2"},{"name":"Broccoli","amount":"75g"}]$j$::jsonb,
      $j${"protein":"54.5g","carbs":"38g","fat":"11g","calories":"469 kcal"}$j$::jsonb),
    ('tuesday', 'MacroBox - Healthy Foods',
      $j$[{"name":"Basmathi rice","amount":"100g"},{"name":"Roasted chickpeas","amount":"75g"},{"name":"Eggs","amount":"2"},{"name":"Black pepper chicken","amount":"100g"},{"name":"Salad","amount":"75g"}]$j$::jsonb,
      $j${"protein":"58g","carbs":"71.3g","fat":"23.9g","calories":"542.6 kcal"}$j$::jsonb),
    ('wednesday', 'MacroBox - Healthy Foods',
      $j$[{"name":"Basmathi rice","amount":"100g"},{"name":"Black pepper chicken","amount":"100g"},{"name":"Gotukola sambol","amount":"75g"},{"name":"Baked potato","amount":"75g"},{"name":"Eggs","amount":"2"}]$j$::jsonb,
      $j${"protein":"48g","carbs":"175.2g","fat":"176.4g","calories":"546.4 kcal"}$j$::jsonb),
    ('thursday', 'MacroBox - Healthy Foods',
      $j$[{"name":"Basmathi rice","amount":"100g"},{"name":"Chicken breast","amount":"100g"},{"name":"Eggs","amount":"2"},{"name":"Dhal curry","amount":"75g"},{"name":"Boiled vegetables (carrot, beans, potato, cabbage)","amount":"75g"}]$j$::jsonb,
      $j${"protein":"52.3g","carbs":"44.3g","fat":"16.9g","calories":"538.5 kcal"}$j$::jsonb),
    ('friday', 'MacroBox - Healthy Foods',
      $j$[{"name":"Basmathi rice","amount":"100g"},{"name":"Boiled corn","amount":"75g"},{"name":"Black pepper chicken","amount":"100g"},{"name":"Eggs","amount":"2"},{"name":"Chinese cucumber","amount":"75g"}]$j$::jsonb,
      $j${"protein":"49.4g","carbs":"47.3g","fat":"15.4g","calories":"525.4 kcal"}$j$::jsonb)
),
inserted as (
  insert into public.products (title, category_id, ingredients, macros, base_price, is_active)
  select s.title, c.id, s.ingredients, s.macros, 0.00, true
  from seed s
  join public.categories c on c.slug = s.day_slug
  where not exists (
    select 1 from public.products p where p.category_id = c.id and p.title = s.title
  )
  returning id
)
select count(*) as products_created from inserted;
