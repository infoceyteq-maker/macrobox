-- Individual daily items: expose each supplied weekday-combo ingredient as a
-- separately purchasable product in the same weekday category.
--
-- The ingredient names and amounts are derived from the existing combo
-- products, so no new menu data is invented. Prices remain 0.00 ("price
-- pending") until Admin confirms approved standalone pricing. Supports both
-- `public` and `macrobox_pos`, matching the dynamic-schema pattern used by
-- earlier POS migrations.

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
insert into @SCHEMA@.products
  (title, category_id, ingredients, macros, base_price, is_active)
select distinct
  ingredient ->> 'name',
  combo.category_id,
  jsonb_build_array(ingredient),
  '{}'::jsonb,
  0.00,
  true
from @SCHEMA@.products combo
cross join lateral jsonb_array_elements(combo.ingredients) as ingredient
where combo.title = 'MacroBox - Healthy Foods'
  and nullif(btrim(ingredient ->> 'name'), '') is not null
  and not exists (
    select 1
    from @SCHEMA@.products existing
    where existing.category_id = combo.category_id
      and existing.title = ingredient ->> 'name'
  );
  $fn$;

  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));
end
$migration$;

notify pgrst, 'reload schema';
