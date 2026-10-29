-- Products Management (Master Admin): structured product fields used by the
-- Admin Products module and reflected in the public customer menu.
--
-- Existing architecture notes:
-- - `category_id` remains the weekday/Everyday grouping used by the menu.
-- - `base_price` remains the customer/order price for backwards compatibility;
--   Products Management keeps it equal to `retail_price`.
-- - `cost_price` is private Admin/P&L data and is not selected by the public
--   menu action.
-- Supports both `public` and `macrobox_pos`, matching earlier POS migrations.

do $migration$
declare
  v_schema text;
  v_sql text;
begin
  if to_regclass('macrobox_pos.products') is not null then
    v_schema := 'macrobox_pos';
  elsif to_regclass('public.products') is not null then
    v_schema := 'public';
  else
    raise exception 'POS products table was not found';
  end if;

  v_sql := $fn$
alter table @SCHEMA@.products
  add column if not exists day_assignment text not null default 'Everyday',
  add column if not exists quantity text,
  add column if not exists product_category text,
  add column if not exists cost_price numeric(12,2) not null default 0,
  add column if not exists retail_price numeric(12,2) not null default 0,
  add column if not exists image_url text;

alter table @SCHEMA@.products
  drop constraint if exists products_day_assignment_check,
  drop constraint if exists products_cost_price_check,
  drop constraint if exists products_retail_price_check;

alter table @SCHEMA@.products
  add constraint products_day_assignment_check
    check (day_assignment in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Everyday')),
  add constraint products_cost_price_check check (cost_price >= 0),
  add constraint products_retail_price_check check (retail_price >= 0);

update @SCHEMA@.products p
set
  day_assignment = case
    when c.name in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
      then c.name
    else 'Everyday'
  end,
  retail_price = case
    when p.retail_price = 0 and p.base_price <> 0 then p.base_price
    else p.retail_price
  end,
  quantity = coalesce(
    p.quantity,
    case
      when jsonb_typeof(p.ingredients) = 'array'
       and jsonb_array_length(p.ingredients) = 1
        then nullif(p.ingredients -> 0 ->> 'amount', '')
      else null
    end
  )
from @SCHEMA@.categories c
where c.id = p.category_id;
  $fn$;

  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Product image uploads use this public-read bucket. Writes happen through
  -- the Admin-only server action (service role after an ADMIN role check), so
  -- no broad client write policy is created here.
  if to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public)
    values ('public_assets', 'public_assets', true)
    on conflict (id) do update set public = excluded.public;
  end if;
end
$migration$;

notify pgrst, 'reload schema';
