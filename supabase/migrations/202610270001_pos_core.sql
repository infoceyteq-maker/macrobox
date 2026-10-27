-- MacroBox POS & Restaurant Management — core schema, state machine, and RLS
-- Target: Supabase / PostgreSQL 15+
--
-- Design notes:
-- 1. Admin is omnipotent for order status transitions, but financial/delivery
--    evidence invariants are still enforced in the database.
-- 2. The Driver is the only mandatory separate physical role.
-- 3. Front Desk is modeled explicitly because PENDING -> ACCEPTED is described
--    as a Front/Admin responsibility. Manager is an operational supervisor.
-- 4. No prices, nutrition values, salary values, or per-km rates are seeded.
--    Admin configures the transport rate through set_transport_rate().

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------

do $$ begin
  create type public.app_role as enum (
    'ADMIN',
    'MANAGER',
    'FRONT_DESK',
    'KITCHEN',
    'DRIVER',
    'CUSTOMER'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.employee_status as enum (
    'ACTIVE',
    'SUSPENDED',
    'TERMINATED'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type public.order_status as enum (
    'PENDING',
    'ACCEPTED',
    'PREPARING',
    'READY',
    'DISPATCHED',
    'DELIVERED',
    'CLOSED'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Shared updated_at trigger
-- ---------------------------------------------------------------------------

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ---------------------------------------------------------------------------
-- Users / employees / customers
-- ---------------------------------------------------------------------------

create table if not exists public.app_users (
  id uuid primary key references auth.users(id) on delete cascade,
  role public.app_role not null default 'CUSTOMER',
  name text not null check (char_length(name) between 1 and 160),
  email text unique,
  phone text,
  salary_structure jsonb not null default '{}'::jsonb
    check (jsonb_typeof(salary_structure) = 'object'),
  status public.employee_status not null default 'ACTIVE',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists app_users_role_status_idx
  on public.app_users (role, status);

drop trigger if exists app_users_set_updated_at on public.app_users;
create trigger app_users_set_updated_at
before update on public.app_users
for each row execute function public.set_updated_at();

-- New Supabase Auth users become CUSTOMER by default. Promote staff in a
-- controlled admin process; do not let users self-assign roles.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.app_users (id, role, name, email)
  values (
    new.id,
    'CUSTOMER',
    coalesce(
      nullif(new.raw_user_meta_data ->> 'name', ''),
      nullif(split_part(coalesce(new.email, ''), '@', 1), ''),
      'New user'
    ),
    new.email
  )
  on conflict (id) do nothing;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- Categories and products
-- ---------------------------------------------------------------------------

create table if not exists public.categories (
  id uuid primary key default gen_random_uuid(),
  name text not null unique,
  slug text not null unique,
  description text,
  sort_order integer not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.products (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(title) between 1 and 200),
  category_id uuid not null references public.categories(id) on delete restrict,
  ingredients jsonb not null default '[]'::jsonb
    check (jsonb_typeof(ingredients) = 'array'),
  macros jsonb not null default '{}'::jsonb
    check (jsonb_typeof(macros) = 'object'),
  base_price numeric(12,2) not null check (base_price >= 0),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists products_category_id_idx on public.products (category_id);
create index if not exists products_is_active_idx on public.products (is_active);

drop trigger if exists categories_set_updated_at on public.categories;
create trigger categories_set_updated_at
before update on public.categories
for each row execute function public.set_updated_at();

drop trigger if exists products_set_updated_at on public.products;
create trigger products_set_updated_at
before update on public.products
for each row execute function public.set_updated_at();

-- Visibility is Admin-controlled even if another privileged server path tries
-- to update products directly.
create or replace function public.protect_product_visibility()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.app_users;
begin
  if tg_op = 'UPDATE' and new.is_active is distinct from old.is_active then
    if auth.uid() is null then
      return new; -- service-role/admin maintenance path
    end if;

    select * into v_actor from public.app_current_actor();

    if v_actor.role <> 'ADMIN' then
      raise exception 'PRODUCT_VISIBILITY_ADMIN_ONLY';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists products_protect_visibility on public.products;
create trigger products_protect_visibility
before update on public.products
for each row execute function public.protect_product_visibility();

-- ---------------------------------------------------------------------------
-- Delivery settings
-- ---------------------------------------------------------------------------

create table if not exists public.delivery_settings (
  id boolean primary key default true check (id),
  free_distance_km numeric(8,2) not null default 2 check (free_distance_km >= 0),
  per_km_rate numeric(12,2) check (per_km_rate is null or per_km_rate >= 0),
  updated_by uuid references public.app_users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.delivery_settings (id)
values (true)
on conflict (id) do nothing;

-- ---------------------------------------------------------------------------
-- Orders and order items
-- ---------------------------------------------------------------------------

create table if not exists public.orders (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.app_users(id) on delete restrict,
  driver_id uuid references public.app_users(id) on delete set null,

  status public.order_status not null default 'PENDING',
  total_food_cost numeric(12,2) not null default 0 check (total_food_cost >= 0),
  transport_cost numeric(12,2) not null default 0 check (transport_cost >= 0),
  final_total numeric(12,2) generated always as (total_food_cost + transport_cost) stored,

  delivery_address text,
  delivery_notes text,

  distance_km numeric(8,2) check (distance_km is null or distance_km >= 0),
  transport_calculated_at timestamptz,

  delivery_signature_url text,
  cash_collected_amount numeric(12,2) check (
    cash_collected_amount is null or cash_collected_amount >= 0
  ),
  cash_collected_at timestamptz,
  cash_collected_by uuid references public.app_users(id) on delete set null,
  cash_settlement_reference text,
  cash_settled_at timestamptz,

  accepted_by uuid references public.app_users(id) on delete set null,
  accepted_at timestamptz,
  preparing_by uuid references public.app_users(id) on delete set null,
  preparing_at timestamptz,
  ready_by uuid references public.app_users(id) on delete set null,
  ready_at timestamptz,
  dispatched_by uuid references public.app_users(id) on delete set null,
  dispatched_at timestamptz,
  delivered_by uuid references public.app_users(id) on delete set null,
  closed_by uuid references public.app_users(id) on delete set null,

  driver_assigned_by uuid references public.app_users(id) on delete set null,
  driver_assigned_at timestamptz,

  version bigint not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint orders_dispatched_requires_driver check (
    status not in ('DISPATCHED', 'DELIVERED', 'CLOSED') or driver_id is not null
  ),
  constraint orders_delivered_requires_evidence check (
    status <> 'DELIVERED' or (
      delivery_signature_url is not null
      and cash_collected_at is not null
      and transport_calculated_at is not null
    )
  ),
  constraint orders_closed_requires_cash_settlement check (
    status <> 'CLOSED' or cash_settled_at is not null
  ),
  constraint orders_cash_settled_after_collection check (
    cash_settled_at is null or cash_collected_at is not null
  )
);

create index if not exists orders_status_created_at_idx
  on public.orders (status, created_at desc);
create index if not exists orders_customer_id_idx on public.orders (customer_id);
create index if not exists orders_driver_id_idx on public.orders (driver_id);

drop trigger if exists orders_set_updated_at on public.orders;
create trigger orders_set_updated_at
before update on public.orders
for each row execute function public.set_updated_at();

create table if not exists public.order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  product_id uuid references public.products(id) on delete set null,
  title_snapshot text not null,
  ingredients_snapshot jsonb not null default '[]'::jsonb
    check (jsonb_typeof(ingredients_snapshot) = 'array'),
  macros_snapshot jsonb not null default '{}'::jsonb
    check (jsonb_typeof(macros_snapshot) = 'object'),
  quantity integer not null check (quantity > 0),
  unit_price numeric(12,2) not null check (unit_price >= 0),
  line_total numeric(12,2) generated always as (unit_price * quantity) stored,
  created_at timestamptz not null default now()
);

create index if not exists order_items_order_id_idx on public.order_items (order_id);

-- ---------------------------------------------------------------------------
-- Audit and transition matrix
-- ---------------------------------------------------------------------------

create table if not exists public.order_status_history (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  from_status public.order_status,
  to_status public.order_status not null,
  actor_id uuid not null references public.app_users(id) on delete restrict,
  actor_role public.app_role not null,
  is_admin_override boolean not null default false,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists order_status_history_order_created_idx
  on public.order_status_history (order_id, created_at);

create table if not exists public.order_audit_events (
  id bigint generated always as identity primary key,
  order_id uuid not null references public.orders(id) on delete cascade,
  event_type text not null check (char_length(event_type) between 1 and 80),
  actor_id uuid not null references public.app_users(id) on delete restrict,
  actor_role public.app_role not null,
  metadata jsonb not null default '{}'::jsonb
    check (jsonb_typeof(metadata) = 'object'),
  created_at timestamptz not null default now()
);

create index if not exists order_audit_events_order_created_idx
  on public.order_audit_events (order_id, created_at);

create table if not exists public.order_status_transitions (
  from_status public.order_status not null,
  to_status public.order_status not null,
  allowed_roles public.app_role[] not null,
  primary key (from_status, to_status),
  check (from_status <> to_status),
  check (cardinality(allowed_roles) > 0)
);

-- Admin is present for clarity, but transition_order_status() lets ADMIN bypass
-- this matrix entirely. Other roles are restricted to these exact edges.
insert into public.order_status_transitions (from_status, to_status, allowed_roles)
values
  ('PENDING',    'ACCEPTED',   array['ADMIN','MANAGER','FRONT_DESK']::public.app_role[]),
  ('ACCEPTED',   'PREPARING',  array['ADMIN','MANAGER','KITCHEN']::public.app_role[]),
  ('PREPARING',  'READY',      array['ADMIN','MANAGER','KITCHEN']::public.app_role[]),
  ('READY',      'DISPATCHED', array['ADMIN','MANAGER','FRONT_DESK']::public.app_role[]),
  ('DISPATCHED', 'DELIVERED',  array['ADMIN','MANAGER','DRIVER']::public.app_role[]),
  ('DELIVERED',  'CLOSED',     array['ADMIN','MANAGER']::public.app_role[])
on conflict (from_status, to_status)
do update set allowed_roles = excluded.allowed_roles;

-- ---------------------------------------------------------------------------
-- Actor helpers
-- ---------------------------------------------------------------------------

create or replace function public.app_current_actor()
returns public.app_users
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.app_users;
begin
  if auth.uid() is null then
    raise exception 'UNAUTHENTICATED';
  end if;

  select * into v_actor
  from public.app_users
  where id = auth.uid();

  if not found then
    raise exception 'USER_NOT_PROVISIONED';
  end if;

  if v_actor.status <> 'ACTIVE' then
    raise exception 'USER_INACTIVE';
  end if;

  return v_actor;
end;
$$;

create or replace function public.app_has_role(p_roles public.app_role[])
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1
    from public.app_users
    where id = auth.uid()
      and status = 'ACTIVE'
      and role = any(p_roles)
  );
$$;

create or replace function public.assert_active_driver(p_driver_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_driver public.app_users;
begin
  select * into v_driver
  from public.app_users
  where id = p_driver_id;

  if not found then
    raise exception 'DRIVER_NOT_FOUND';
  end if;

  if v_driver.role <> 'DRIVER' then
    raise exception 'ASSIGNEE_IS_NOT_DRIVER';
  end if;

  if v_driver.status <> 'ACTIVE' then
    raise exception 'DRIVER_INACTIVE';
  end if;
end;
$$;

-- ---------------------------------------------------------------------------
-- Transport billing
-- ---------------------------------------------------------------------------

create or replace function public.calculate_transport_cost(
  p_distance_km numeric,
  p_per_km_rate numeric default null,
  p_free_distance_km numeric default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = public, pg_temp
as $$
declare
  v_settings public.delivery_settings;
  v_rate numeric;
  v_free_distance numeric;
begin
  if p_distance_km is null or p_distance_km < 0 then
    raise exception 'INVALID_DISTANCE';
  end if;

  select * into v_settings
  from public.delivery_settings
  where id = true;

  v_rate := coalesce(p_per_km_rate, v_settings.per_km_rate);
  v_free_distance := coalesce(p_free_distance_km, v_settings.free_distance_km);

  if v_rate is null then
    raise exception 'TRANSPORT_RATE_NOT_CONFIGURED';
  end if;

  if v_rate < 0 or v_free_distance < 0 then
    raise exception 'INVALID_TRANSPORT_SETTINGS';
  end if;

  return round(greatest(p_distance_km - v_free_distance, 0) * v_rate, 2);
end;
$$;

create or replace function public.set_transport_rate(
  p_per_km_rate numeric,
  p_free_distance_km numeric default null
)
returns public.delivery_settings
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.app_users;
  v_settings public.delivery_settings;
begin
  select * into v_actor from public.app_current_actor();

  if v_actor.role <> 'ADMIN' then
    raise exception 'TRANSPORT_RATE_ADMIN_ONLY';
  end if;

  if p_per_km_rate is null or p_per_km_rate < 0 then
    raise exception 'INVALID_PER_KM_RATE';
  end if;

  if p_free_distance_km is not null and p_free_distance_km < 0 then
    raise exception 'INVALID_FREE_DISTANCE';
  end if;

  update public.delivery_settings
  set
    per_km_rate = p_per_km_rate,
    free_distance_km = coalesce(p_free_distance_km, free_distance_km),
    updated_by = v_actor.id,
    updated_at = now()
  where id = true
  returning * into v_settings;

  return v_settings;
end;
$$;

-- ---------------------------------------------------------------------------
-- Catalog admin helper
-- ---------------------------------------------------------------------------

create or replace function public.set_product_active(
  p_product_id uuid,
  p_is_active boolean
)
returns public.products
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.app_users;
  v_product public.products;
begin
  select * into v_actor from public.app_current_actor();

  if v_actor.role <> 'ADMIN' then
    raise exception 'PRODUCT_VISIBILITY_ADMIN_ONLY';
  end if;

  update public.products
  set is_active = p_is_active
  where id = p_product_id
  returning * into v_product;

  if not found then
    raise exception 'PRODUCT_NOT_FOUND';
  end if;

  return v_product;
end;
$$;

-- ---------------------------------------------------------------------------
-- Order creation
-- ---------------------------------------------------------------------------

create or replace function public.create_order_with_items(
  p_customer_id uuid,
  p_items jsonb,
  p_delivery_address text default null,
  p_delivery_notes text default null
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.app_users;
  v_customer public.app_users;
  v_order public.orders;
  v_item jsonb;
  v_product public.products;
  v_product_id uuid;
  v_quantity integer;
  v_total numeric(12,2) := 0;
  v_count integer := 0;
begin
  select * into v_actor from public.app_current_actor();

  if v_actor.role not in ('ADMIN','MANAGER','FRONT_DESK','CUSTOMER') then
    raise exception 'ORDER_CREATE_NOT_ALLOWED';
  end if;

  if v_actor.role = 'CUSTOMER' and p_customer_id <> v_actor.id then
    raise exception 'CUSTOMERS_CREATE_OWN_ORDERS_ONLY';
  end if;

  select * into v_customer
  from public.app_users
  where id = p_customer_id;

  if not found or v_customer.role <> 'CUSTOMER' or v_customer.status <> 'ACTIVE' then
    raise exception 'INVALID_CUSTOMER';
  end if;

  if p_items is null
     or jsonb_typeof(p_items) <> 'array'
     or jsonb_array_length(p_items) = 0 then
    raise exception 'ORDER_ITEMS_REQUIRED';
  end if;

  insert into public.orders (
    customer_id,
    status,
    total_food_cost,
    transport_cost,
    delivery_address,
    delivery_notes
  )
  values (
    p_customer_id,
    'PENDING',
    0,
    0,
    nullif(p_delivery_address, ''),
    nullif(p_delivery_notes, '')
  )
  returning * into v_order;

  for v_item in select value from jsonb_array_elements(p_items)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or not (v_item ? 'productId')
       or not (v_item ? 'quantity') then
      raise exception 'INVALID_ORDER_ITEM';
    end if;

    begin
      v_product_id := (v_item ->> 'productId')::uuid;
    exception when others then
      raise exception 'INVALID_PRODUCT_ID';
    end;

    if jsonb_typeof(v_item -> 'quantity') <> 'number' then
      raise exception 'INVALID_QUANTITY';
    end if;

    v_quantity := (v_item ->> 'quantity')::integer;

    if v_quantity is null or v_quantity <= 0 then
      raise exception 'INVALID_QUANTITY';
    end if;

    select * into v_product
    from public.products
    where id = v_product_id and is_active = true;

    if not found then
      raise exception 'PRODUCT_NOT_AVAILABLE';
    end if;

    insert into public.order_items (
      order_id,
      product_id,
      title_snapshot,
      ingredients_snapshot,
      macros_snapshot,
      quantity,
      unit_price
    )
    values (
      v_order.id,
      v_product.id,
      v_product.title,
      v_product.ingredients,
      v_product.macros,
      v_quantity,
      v_product.base_price
    );

    v_total := v_total + (v_product.base_price * v_quantity);
    v_count := v_count + 1;
  end loop;

  update public.orders
  set total_food_cost = round(v_total, 2)
  where id = v_order.id
  returning * into v_order;

  insert into public.order_status_history (
    order_id,
    from_status,
    to_status,
    actor_id,
    actor_role,
    metadata
  )
  values (
    v_order.id,
    null,
    'PENDING',
    v_actor.id,
    v_actor.role,
    jsonb_build_object('itemCount', v_count)
  );

  insert into public.order_audit_events (
    order_id,
    event_type,
    actor_id,
    actor_role,
    metadata
  )
  values (
    v_order.id,
    'ORDER_CREATED',
    v_actor.id,
    v_actor.role,
    jsonb_build_object('itemCount', v_count)
  );

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Driver assignment
-- ---------------------------------------------------------------------------

create or replace function public.assign_driver_to_order(
  p_order_id uuid,
  p_driver_id uuid,
  p_dispatch boolean default false,
  p_expected_status public.order_status default 'READY'
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.app_users;
  v_order public.orders;
  v_expected_status public.order_status;
begin
  select * into v_actor from public.app_current_actor();

  if v_actor.role not in ('ADMIN','MANAGER') then
    raise exception 'DRIVER_ASSIGNMENT_ADMIN_OR_MANAGER_ONLY';
  end if;

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  if v_order.status in ('DELIVERED','CLOSED') then
    raise exception 'ORDER_ALREADY_FINALIZED';
  end if;

  v_expected_status := coalesce(p_expected_status, 'READY'::public.order_status);

  -- Admin omnipotence: can assign early to fast-track dispatch.
  -- Manager remains constrained to the expected READY state.
  if v_actor.role <> 'ADMIN' and v_order.status <> v_expected_status then
    raise exception 'ORDER_NOT_READY_FOR_DRIVER'
      using detail = format('Expected %s, found %s', v_expected_status, v_order.status);
  end if;

  perform public.assert_active_driver(p_driver_id);

  update public.orders
  set
    driver_id = p_driver_id,
    driver_assigned_by = v_actor.id,
    driver_assigned_at = coalesce(driver_assigned_at, now()),
    version = version + 1
  where id = p_order_id
  returning * into v_order;

  insert into public.order_audit_events (
    order_id,
    event_type,
    actor_id,
    actor_role,
    metadata
  )
  values (
    p_order_id,
    'DRIVER_ASSIGNED',
    v_actor.id,
    v_actor.role,
    jsonb_build_object('driverId', p_driver_id, 'dispatch', p_dispatch)
  );

  if p_dispatch then
    v_order := public.transition_order_status(
      p_order_id,
      'DISPATCHED'::public.order_status,
      v_order.status,
      v_order.version,
      jsonb_build_object('driverId', p_driver_id, 'source', 'assign_driver_to_order')
    );
  end if;

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Order status state machine
-- ---------------------------------------------------------------------------

-- Authoritative state machine. All role checks, invariants, and audit writes
-- happen atomically inside this function.
create or replace function public.transition_order_status(
  p_order_id uuid,
  p_to_status public.order_status,
  p_expected_status public.order_status default null,
  p_expected_version bigint default null,
  p_metadata jsonb default '{}'::jsonb
)
returns public.orders
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_actor public.app_users;
  v_order public.orders;
  v_previous_status public.order_status;
  v_metadata jsonb := coalesce(p_metadata, '{}'::jsonb);
  v_matrix_allows boolean := false;
  v_is_admin boolean := false;
  v_is_admin_override boolean := false;
  v_driver_id uuid;
  v_distance_km numeric;
  v_transport_cost numeric;
  v_cash_collected numeric;
  v_expected_total numeric;
  v_signature_url text;
  v_settlement_reference text;
begin
  if jsonb_typeof(v_metadata) <> 'object' then
    raise exception 'INVALID_METADATA';
  end if;

  select * into v_actor from public.app_current_actor();
  v_is_admin := v_actor.role = 'ADMIN';

  select * into v_order
  from public.orders
  where id = p_order_id
  for update;

  if not found then
    raise exception 'ORDER_NOT_FOUND';
  end if;

  v_previous_status := v_order.status;

  if p_expected_status is not null and v_previous_status <> p_expected_status then
    raise exception 'ORDER_STATUS_CONFLICT'
      using detail = format('Expected %s, found %s', p_expected_status, v_previous_status);
  end if;

  if p_expected_version is not null and v_order.version <> p_expected_version then
    raise exception 'ORDER_VERSION_CONFLICT'
      using detail = format('Expected version %s, found %s', p_expected_version, v_order.version);
  end if;

  if v_previous_status = p_to_status then
    raise exception 'ORDER_ALREADY_IN_STATUS';
  end if;

  select exists (
    select 1
    from public.order_status_transitions t
    where t.from_status = v_previous_status
      and t.to_status = p_to_status
      and v_actor.role = any(t.allowed_roles)
  ) into v_matrix_allows;

  if not v_is_admin and not v_matrix_allows then
    raise exception 'ORDER_TRANSITION_NOT_ALLOWED'
      using detail = format('%s cannot move %s -> %s', v_actor.role, v_previous_status, p_to_status);
  end if;

  if not v_is_admin and v_actor.role = 'DRIVER' and v_order.driver_id <> v_actor.id then
    raise exception 'DRIVER_NOT_ASSIGNED_TO_ORDER';
  end if;

  v_is_admin_override := v_is_admin and not v_matrix_allows;

  if v_metadata ? 'driverId' and nullif(v_metadata ->> 'driverId', '') is not null then
    v_driver_id := (v_metadata ->> 'driverId')::uuid;
    perform public.assert_active_driver(v_driver_id);
  else
    v_driver_id := v_order.driver_id;
  end if;

  if p_to_status in ('DISPATCHED','DELIVERED','CLOSED') and v_driver_id is null then
    raise exception 'DRIVER_REQUIRED_FOR_DISPATCH';
  end if;

  if p_to_status = 'ACCEPTED' then
    update public.orders set
      status = p_to_status,
      accepted_by = coalesce(accepted_by, v_actor.id),
      accepted_at = coalesce(accepted_at, now()),
      version = version + 1
    where id = p_order_id returning * into v_order;

  elsif p_to_status = 'PREPARING' then
    update public.orders set
      status = p_to_status,
      preparing_by = coalesce(preparing_by, v_actor.id),
      preparing_at = coalesce(preparing_at, now()),
      version = version + 1
    where id = p_order_id returning * into v_order;

  elsif p_to_status = 'READY' then
    update public.orders set
      status = p_to_status,
      ready_by = coalesce(ready_by, v_actor.id),
      ready_at = coalesce(ready_at, now()),
      version = version + 1
    where id = p_order_id returning * into v_order;

  elsif p_to_status = 'DISPATCHED' then
    update public.orders set
      status = p_to_status,
      driver_id = v_driver_id,
      driver_assigned_by = coalesce(driver_assigned_by, v_actor.id),
      driver_assigned_at = coalesce(driver_assigned_at, now()),
      dispatched_by = coalesce(dispatched_by, v_actor.id),
      dispatched_at = coalesce(dispatched_at, now()),
      version = version + 1
    where id = p_order_id returning * into v_order;

  elsif p_to_status = 'DELIVERED' then
    v_signature_url := nullif(v_metadata ->> 'signatureUrl', '');
    if v_signature_url is null then
      raise exception 'DELIVERY_SIGNATURE_REQUIRED';
    end if;

    v_distance_km := nullif(v_metadata ->> 'distanceKm', '')::numeric;

    if v_distance_km is null then
      v_distance_km := v_order.distance_km;
    end if;

    if v_distance_km is null and v_order.transport_calculated_at is null then
      raise exception 'DISTANCE_REQUIRED_AT_DELIVERY';
    end if;

    if v_order.distance_km is not null
       and v_distance_km is not null
       and abs(v_order.distance_km - v_distance_km) > 0.01 then
      raise exception 'DISTANCE_CONFLICT';
    end if;

    if v_order.transport_calculated_at is null then
      v_transport_cost := public.calculate_transport_cost(v_distance_km);
    else
      v_transport_cost := v_order.transport_cost;
    end if;

    v_expected_total := v_order.total_food_cost + v_transport_cost;

    if nullif(v_metadata ->> 'cashCollectedAmount', '') is null then
      raise exception 'CASH_COLLECTED_AMOUNT_REQUIRED';
    end if;

    v_cash_collected := (v_metadata ->> 'cashCollectedAmount')::numeric;

    if abs(v_cash_collected - v_expected_total) > 0.01 then
      raise exception 'CASH_COLLECTED_AMOUNT_MISMATCH'
        using detail = format('Expected %s, received %s', v_expected_total, v_cash_collected);
    end if;

    update public.orders set
      status = p_to_status,
      driver_id = v_driver_id,
      distance_km = coalesce(v_order.distance_km, v_distance_km),
      transport_cost = v_transport_cost,
      transport_calculated_at = coalesce(v_order.transport_calculated_at, now()),
      delivery_signature_url = v_signature_url,
      cash_collected_amount = v_cash_collected,
      cash_collected_at = coalesce(v_order.cash_collected_at, now()),
      cash_collected_by = coalesce(v_order.cash_collected_by, v_actor.id),
      delivered_by = coalesce(v_order.delivered_by, v_actor.id),
      version = version + 1
    where id = p_order_id returning * into v_order;

  elsif p_to_status = 'CLOSED' then
    v_settlement_reference := nullif(v_metadata ->> 'cashSettlementReference', '');

    if v_settlement_reference is null then
      raise exception 'CASH_SETTLEMENT_REFERENCE_REQUIRED';
    end if;

    if v_order.cash_collected_at is null or v_order.delivery_signature_url is null then
      raise exception 'DELIVERY_EVIDENCE_REQUIRED_BEFORE_CLOSE';
    end if;

    update public.orders set
      status = p_to_status,
      driver_id = v_driver_id,
      cash_settlement_reference = v_settlement_reference,
      cash_settled_at = coalesce(cash_settled_at, now()),
      closed_by = coalesce(closed_by, v_actor.id),
      version = version + 1
    where id = p_order_id returning * into v_order;
  else
    raise exception 'UNSUPPORTED_TARGET_STATUS';
  end if;

  insert into public.order_status_history (
    order_id,
    from_status,
    to_status,
    actor_id,
    actor_role,
    is_admin_override,
    metadata
  )
  values (
    p_order_id,
    v_previous_status,
    p_to_status,
    v_actor.id,
    v_actor.role,
    v_is_admin_override,
    v_metadata
  );

  return v_order;
end;
$$;

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------

alter table public.app_users enable row level security;
alter table public.categories enable row level security;
alter table public.products enable row level security;
alter table public.delivery_settings enable row level security;
alter table public.orders enable row level security;
alter table public.order_items enable row level security;
alter table public.order_status_history enable row level security;
alter table public.order_audit_events enable row level security;
alter table public.order_status_transitions enable row level security;

revoke all on
  public.app_users,
  public.categories,
  public.products,
  public.delivery_settings,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.order_audit_events,
  public.order_status_transitions
from anon, authenticated;

grant select on
  public.app_users,
  public.categories,
  public.products,
  public.delivery_settings,
  public.orders,
  public.order_items,
  public.order_status_history,
  public.order_audit_events,
  public.order_status_transitions
to authenticated;

grant update on public.app_users to authenticated;
grant insert, update, delete on public.categories to authenticated;
grant insert, update, delete on public.products to authenticated;

-- app_users
drop policy if exists app_users_select_self_or_admin on public.app_users;
create policy app_users_select_self_or_admin
on public.app_users for select
to authenticated
using (
  id = auth.uid()
  or public.app_has_role(array['ADMIN','MANAGER']::public.app_role[])
);

drop policy if exists app_users_admin_write on public.app_users;
create policy app_users_admin_write
on public.app_users for all
to authenticated
using (public.app_has_role(array['ADMIN']::public.app_role[]))
with check (public.app_has_role(array['ADMIN']::public.app_role[]));

-- categories / products
drop policy if exists categories_read on public.categories;
create policy categories_read
on public.categories for select
to authenticated
using (
  is_active
  or public.app_has_role(array['ADMIN','MANAGER','FRONT_DESK','KITCHEN','DRIVER']::public.app_role[])
);

drop policy if exists categories_admin_write on public.categories;
create policy categories_admin_write
on public.categories for all
to authenticated
using (public.app_has_role(array['ADMIN']::public.app_role[]))
with check (public.app_has_role(array['ADMIN']::public.app_role[]));

drop policy if exists products_read on public.products;
create policy products_read
on public.products for select
to authenticated
using (
  is_active
  or public.app_has_role(array['ADMIN','MANAGER','FRONT_DESK','KITCHEN','DRIVER']::public.app_role[])
);

drop policy if exists products_admin_write on public.products;
create policy products_admin_write
on public.products for all
to authenticated
using (public.app_has_role(array['ADMIN']::public.app_role[]))
with check (public.app_has_role(array['ADMIN']::public.app_role[]));

-- delivery settings: readable, mutable only through admin RPC.
drop policy if exists delivery_settings_read on public.delivery_settings;
create policy delivery_settings_read
on public.delivery_settings for select
to authenticated
using (true);

-- orders: customers see their orders, drivers see assigned orders, staff see all.
drop policy if exists orders_read on public.orders;
create policy orders_read
on public.orders for select
to authenticated
using (
  customer_id = auth.uid()
  or driver_id = auth.uid()
  or public.app_has_role(array['ADMIN','MANAGER','FRONT_DESK','KITCHEN']::public.app_role[])
);

-- order children inherit order visibility.
drop policy if exists order_items_read on public.order_items;
create policy order_items_read
on public.order_items for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.customer_id = auth.uid()
        or o.driver_id = auth.uid()
        or public.app_has_role(array['ADMIN','MANAGER','FRONT_DESK','KITCHEN']::public.app_role[])
      )
  )
);

drop policy if exists order_status_history_read on public.order_status_history;
create policy order_status_history_read
on public.order_status_history for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.customer_id = auth.uid()
        or o.driver_id = auth.uid()
        or public.app_has_role(array['ADMIN','MANAGER','FRONT_DESK','KITCHEN']::public.app_role[])
      )
  )
);

drop policy if exists order_audit_events_read on public.order_audit_events;
create policy order_audit_events_read
on public.order_audit_events for select
to authenticated
using (
  exists (
    select 1 from public.orders o
    where o.id = order_id
      and (
        o.customer_id = auth.uid()
        or o.driver_id = auth.uid()
        or public.app_has_role(array['ADMIN','MANAGER','FRONT_DESK','KITCHEN']::public.app_role[])
      )
  )
);

drop policy if exists order_status_transitions_read on public.order_status_transitions;
create policy order_status_transitions_read
on public.order_status_transitions for select
to authenticated
using (true);

-- ---------------------------------------------------------------------------
-- RPC grants
-- ---------------------------------------------------------------------------

revoke all on function public.app_current_actor() from public;
revoke all on function public.app_has_role(public.app_role[]) from public;
revoke all on function public.assert_active_driver(uuid) from public;
revoke all on function public.calculate_transport_cost(numeric, numeric, numeric) from public;
revoke all on function public.set_transport_rate(numeric, numeric) from public;
revoke all on function public.set_product_active(uuid, boolean) from public;
revoke all on function public.create_order_with_items(uuid, jsonb, text, text) from public;
revoke all on function public.assign_driver_to_order(uuid, uuid, boolean, public.order_status) from public;
revoke all on function public.transition_order_status(uuid, public.order_status, public.order_status, bigint, jsonb) from public;

grant execute on function public.app_current_actor() to authenticated;
grant execute on function public.app_has_role(public.app_role[]) to authenticated;
grant execute on function public.calculate_transport_cost(numeric, numeric, numeric) to authenticated;
grant execute on function public.set_transport_rate(numeric, numeric) to authenticated;
grant execute on function public.set_product_active(uuid, boolean) to authenticated;
grant execute on function public.create_order_with_items(uuid, jsonb, text, text) to authenticated;
grant execute on function public.assign_driver_to_order(uuid, uuid, boolean, public.order_status) to authenticated;
grant execute on function public.transition_order_status(uuid, public.order_status, public.order_status, bigint, jsonb) to authenticated;
