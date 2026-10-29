-- Generated product placeholder photography mapping.
--
-- The image files are served by Next.js from `/images/products/`. This
-- migration only fills blank `image_url` values for the known seeded catalog;
-- any Admin-uploaded product image is preserved.

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
-- Weekday combo products: all seeded combos share the same supplied product
-- title, so the weekday category/day assignment selects the correct image.
update @SCHEMA@.products p
set image_url = case c.name
  when 'Monday' then '/images/products/monday-rice-curry-combo.jpg'
  when 'Tuesday' then '/images/products/tuesday-healthy-bowl.jpg'
  when 'Wednesday' then '/images/products/wednesday-specialty-plate.jpg'
  when 'Thursday' then '/images/products/thursday-lean-meal.jpg'
  when 'Friday' then '/images/products/friday-recovery-bowl.jpg'
  else p.image_url
end
from @SCHEMA@.categories c
where c.id = p.category_id
  and c.name in ('Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday')
  and jsonb_typeof(p.ingredients) = 'array'
  and jsonb_array_length(p.ingredients) > 1
  and (p.image_url is null or btrim(p.image_url) = '');

-- Individually purchasable portions.
update @SCHEMA@.products p
set image_url = case lower(btrim(p.title))
  when 'basmathi rice' then '/images/products/basmathi-rice.jpg'
  when 'dhal curry' then '/images/products/dhal-curry.jpg'
  when 'black pepper chicken' then '/images/products/black-pepper-chicken.jpg'
  when 'eggs' then '/images/products/boiled-eggs.jpg'
  when 'boiled eggs' then '/images/products/boiled-eggs.jpg'
  when 'boiled eggs (2 pieces)' then '/images/products/boiled-eggs.jpg'
  when 'broccoli' then '/images/products/steamed-broccoli.jpg'
  when 'steamed broccoli' then '/images/products/steamed-broccoli.jpg'
  when 'roasted chickpeas' then '/images/products/roasted-chickpeas.jpg'
  when 'salad' then '/images/products/fresh-green-salad.jpg'
  when 'fresh green salad' then '/images/products/fresh-green-salad.jpg'
  when 'gotukola sambol' then '/images/products/gotukola-sambol.jpg'
  when 'baked potato' then '/images/products/baked-potato.jpg'
  when 'chicken breast' then '/images/products/grilled-chicken-breast.jpg'
  when 'grilled chicken breast' then '/images/products/grilled-chicken-breast.jpg'
  when 'boiled vegetables' then '/images/products/boiled-vegetables.jpg'
  when 'boiled corn' then '/images/products/boiled-corn.jpg'
  when 'chinese cucumber' then '/images/products/chinese-cucumber.jpg'
  else p.image_url
end
where (p.image_url is null or btrim(p.image_url) = '')
  and lower(btrim(p.title)) in (
    'basmathi rice',
    'dhal curry',
    'black pepper chicken',
    'eggs',
    'boiled eggs',
    'boiled eggs (2 pieces)',
    'broccoli',
    'steamed broccoli',
    'roasted chickpeas',
    'salad',
    'fresh green salad',
    'gotukola sambol',
    'baked potato',
    'chicken breast',
    'grilled chicken breast',
    'boiled vegetables',
    'boiled corn',
    'chinese cucumber'
  );

-- The seeded boiled-vegetables title includes its contents in parentheses.
update @SCHEMA@.products p
set image_url = '/images/products/boiled-vegetables.jpg'
where (p.image_url is null or btrim(p.image_url) = '')
  and lower(btrim(p.title)) like 'boiled vegetables%';
  $fn$;

  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));
end
$migration$;

notify pgrst, 'reload schema';
