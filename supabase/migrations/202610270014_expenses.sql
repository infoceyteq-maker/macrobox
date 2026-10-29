-- Expenses tracking (Master Admin only).
--
-- The table lives beside the POS tables in `macrobox_pos` in production and
-- in `public` for the local PGlite engine. It is deliberately not exposed to
-- customers, Front Desk, Kitchen, Managers, or Drivers: RLS only allows the
-- ADMIN role to select/insert, and the app's Server Action checks ADMIN again
-- before writing. `added_by` captures the Admin for audit/P&L review.

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
create table if not exists @SCHEMA@.expenses (
  id uuid primary key default gen_random_uuid(),
  category text not null,
  supplier text not null,
  amount numeric(12,2) not null,
  remark text,
  expense_date timestamptz not null default now(),
  added_by uuid references @SCHEMA@.app_users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table @SCHEMA@.expenses
  add column if not exists category text,
  add column if not exists supplier text,
  add column if not exists amount numeric(12,2),
  add column if not exists remark text,
  add column if not exists expense_date timestamptz not null default now(),
  add column if not exists added_by uuid references @SCHEMA@.app_users(id) on delete set null,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now();

alter table @SCHEMA@.expenses
  drop constraint if exists expenses_category_check,
  drop constraint if exists expenses_supplier_check,
  drop constraint if exists expenses_amount_check;

alter table @SCHEMA@.expenses
  add constraint expenses_category_check
    check (category in (
      'Grocery',
      'Meat',
      'Vegetable',
      'Transport',
      'Salaries',
      'Government Payment',
      'Bills',
      'Tax and Bank'
    )),
  add constraint expenses_supplier_check check (btrim(supplier) <> ''),
  add constraint expenses_amount_check check (amount > 0);

create index if not exists expenses_date_idx
  on @SCHEMA@.expenses (expense_date desc);
create index if not exists expenses_category_date_idx
  on @SCHEMA@.expenses (category, expense_date desc);

drop trigger if exists expenses_set_updated_at on @SCHEMA@.expenses;
create trigger expenses_set_updated_at
before update on @SCHEMA@.expenses
for each row execute function @SCHEMA@.set_updated_at();

alter table @SCHEMA@.expenses enable row level security;

revoke all on @SCHEMA@.expenses from anon, authenticated;
grant select, insert on @SCHEMA@.expenses to authenticated;
grant all on @SCHEMA@.expenses to service_role;

drop policy if exists expenses_admin_select on @SCHEMA@.expenses;
create policy expenses_admin_select
on @SCHEMA@.expenses for select
to authenticated
using (@SCHEMA@.app_has_role(array['ADMIN']::@SCHEMA@.app_role[]));

drop policy if exists expenses_admin_insert on @SCHEMA@.expenses;
create policy expenses_admin_insert
on @SCHEMA@.expenses for insert
to authenticated
with check (
  @SCHEMA@.app_has_role(array['ADMIN']::@SCHEMA@.app_role[])
  and added_by = auth.uid()
);
  $fn$;

  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));
end
$migration$;

notify pgrst, 'reload schema';
