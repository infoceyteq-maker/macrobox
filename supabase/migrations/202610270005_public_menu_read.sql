-- Allow unauthenticated digital-menu visitors to read only active categories
-- and active products. Prices remain 0.00 placeholders until Admin sets them.
-- Supports both the fresh-project `public` layout and the connected project's
-- isolated `macrobox_pos` layout without touching legacy public tables.

do $do$
begin
  if to_regclass('public.products') is not null and to_regclass('public.categories') is not null then
    execute $fn$
      grant select on public.products, public.categories to anon;

      drop policy if exists public_menu_read_products on public.products;
      create policy public_menu_read_products
      on public.products for select
      to anon
      using (is_active);

      drop policy if exists public_menu_read_categories on public.categories;
      create policy public_menu_read_categories
      on public.categories for select
      to anon
      using (is_active);
    $fn$;
  end if;
end
$do$;

do $do$
begin
  if to_regclass('macrobox_pos.products') is not null and to_regclass('macrobox_pos.categories') is not null then
    execute $fn$
      grant select on macrobox_pos.products, macrobox_pos.categories to anon;

      drop policy if exists public_menu_read_products on macrobox_pos.products;
      create policy public_menu_read_products
      on macrobox_pos.products for select
      to anon
      using (is_active);

      drop policy if exists public_menu_read_categories on macrobox_pos.categories;
      create policy public_menu_read_categories
      on macrobox_pos.categories for select
      to anon
      using (is_active);
    $fn$;
  end if;
end
$do$;
