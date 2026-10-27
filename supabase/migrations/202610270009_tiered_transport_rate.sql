-- Approved LKR distance-tiered transport billing.
--
-- Exact production rule supplied by the business:
--   * 0–3 km inclusive: LKR 150 flat.
--   * >3–4 km inclusive: LKR 150 + LKR 120 = LKR 270.
--   * >4–5 km inclusive: LKR 270 + LKR 100 = LKR 370.
--   * >5 km: LKR 370 + (distance - 5) * LKR 60 per additional km.
--
-- This supports both `public` and the connected project's isolated
-- `macrobox_pos` schema. The SQL function remains authoritative when an order
-- transitions to DELIVERED; lib/pos/transport.ts mirrors it for UI previews.

do $migration$
declare
  v_schema text;
  v_sql text;
begin
  if to_regclass('macrobox_pos.delivery_settings') is not null then
    v_schema := 'macrobox_pos';
  elsif to_regclass('public.delivery_settings') is not null then
    v_schema := 'public';
  else
    raise exception 'POS delivery_settings table was not found';
  end if;

  execute format($ddl$
    alter table %I.delivery_settings
      add column if not exists rate_model text not null default 'TIERED_LKR',
      add column if not exists currency_code text not null default 'LKR',
      add column if not exists base_distance_km numeric(8,2) not null default 3.00,
      add column if not exists fourth_km_ceiling_km numeric(8,2) not null default 4.00,
      add column if not exists fifth_km_ceiling_km numeric(8,2) not null default 5.00,
      add column if not exists base_rate numeric(12,2) not null default 150.00,
      add column if not exists fourth_km_rate numeric(12,2) not null default 120.00,
      add column if not exists fifth_km_rate numeric(12,2) not null default 100.00,
      add column if not exists beyond_rate_per_km numeric(12,2) not null default 60.00,
      add column if not exists is_configured boolean not null default true;
  $ddl$, v_schema);

  -- Seed/activate the exact approved configuration. `per_km_rate` and
  -- `free_distance_km` are retained for backward-compatible reporting and are
  -- set to the beyond-5-km rate and tier-1 ceiling respectively.
  execute format($seed$
    insert into %I.delivery_settings (
      id, free_distance_km, per_km_rate, rate_model, currency_code,
      base_distance_km, fourth_km_ceiling_km, fifth_km_ceiling_km,
      base_rate, fourth_km_rate, fifth_km_rate, beyond_rate_per_km,
      is_configured
    )
    values (
      true, 3.00, 60.00, 'TIERED_LKR', 'LKR',
      3.00, 4.00, 5.00,
      150.00, 120.00, 100.00, 60.00,
      true
    )
    on conflict (id) do update set
      free_distance_km = excluded.free_distance_km,
      per_km_rate = excluded.per_km_rate,
      rate_model = excluded.rate_model,
      currency_code = excluded.currency_code,
      base_distance_km = excluded.base_distance_km,
      fourth_km_ceiling_km = excluded.fourth_km_ceiling_km,
      fifth_km_ceiling_km = excluded.fifth_km_ceiling_km,
      base_rate = excluded.base_rate,
      fourth_km_rate = excluded.fourth_km_rate,
      fifth_km_rate = excluded.fifth_km_rate,
      beyond_rate_per_km = excluded.beyond_rate_per_km,
      is_configured = excluded.is_configured,
      updated_at = now();
  $seed$, v_schema);

  -- Authoritative calculator. The optional flat-rate parameters are retained
  -- only for legacy FLAT mode; the active model is TIERED_LKR.
  v_sql := $fn$
create or replace function @SCHEMA@.calculate_transport_cost(
  p_distance_km numeric,
  p_per_km_rate numeric default null,
  p_free_distance_km numeric default null
)
returns numeric
language plpgsql
stable
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_settings @SCHEMA@.delivery_settings;
  v_cost numeric;
  v_flat_rate numeric;
  v_free_distance numeric;
begin
  if p_distance_km is null or p_distance_km < 0 then
    raise exception 'INVALID_DISTANCE';
  end if;

  select * into v_settings
  from @SCHEMA@.delivery_settings
  where id = true;

  if not found or not v_settings.is_configured then
    raise exception 'TRANSPORT_RATE_NOT_CONFIGURED';
  end if;

  if v_settings.rate_model = 'TIERED_LKR' then
    if v_settings.base_distance_km <> 3
       or v_settings.fourth_km_ceiling_km <> 4
       or v_settings.fifth_km_ceiling_km <> 5 then
      raise exception 'INVALID_TRANSPORT_SETTINGS';
    end if;

    if p_distance_km <= v_settings.base_distance_km then
      v_cost := v_settings.base_rate;
    elsif p_distance_km <= v_settings.fourth_km_ceiling_km then
      v_cost := v_settings.base_rate + v_settings.fourth_km_rate;
    elsif p_distance_km <= v_settings.fifth_km_ceiling_km then
      v_cost := v_settings.base_rate
        + v_settings.fourth_km_rate
        + v_settings.fifth_km_rate;
    else
      v_cost := v_settings.base_rate
        + v_settings.fourth_km_rate
        + v_settings.fifth_km_rate
        + (p_distance_km - v_settings.fifth_km_ceiling_km)
          * v_settings.beyond_rate_per_km;
    end if;
  else
    v_flat_rate := coalesce(p_per_km_rate, v_settings.per_km_rate);
    v_free_distance := coalesce(p_free_distance_km, v_settings.free_distance_km);

    if v_flat_rate is null
       or v_flat_rate < 0
       or v_free_distance is null
       or v_free_distance < 0 then
      raise exception 'INVALID_TRANSPORT_SETTINGS';
    end if;

    v_cost := greatest(p_distance_km - v_free_distance, 0) * v_flat_rate;
  end if;

  if v_cost is null or v_cost < 0 then
    raise exception 'INVALID_TRANSPORT_SETTINGS';
  end if;

  return round(v_cost, 2);
end
$body$;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Admin-only activation of the exact approved tier values.
  v_sql := $fn$
create or replace function @SCHEMA@.activate_tiered_transport_rate()
returns @SCHEMA@.delivery_settings
language plpgsql
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_actor @SCHEMA@.app_users;
  v_settings @SCHEMA@.delivery_settings;
begin
  select * into v_actor from @SCHEMA@.app_current_actor();
  if v_actor.role <> 'ADMIN' then
    raise exception 'TRANSPORT_RATE_ADMIN_ONLY';
  end if;

  update @SCHEMA@.delivery_settings
     set rate_model = 'TIERED_LKR',
         currency_code = 'LKR',
         free_distance_km = 3.00,
         per_km_rate = 60.00,
         base_distance_km = 3.00,
         fourth_km_ceiling_km = 4.00,
         fifth_km_ceiling_km = 5.00,
         base_rate = 150.00,
         fourth_km_rate = 120.00,
         fifth_km_rate = 100.00,
         beyond_rate_per_km = 60.00,
         is_configured = true,
         updated_by = v_actor.id,
         updated_at = now()
   where id = true
  returning * into v_settings;

  return v_settings;
end
$body$;

revoke all on function @SCHEMA@.activate_tiered_transport_rate() from public;
grant execute on function @SCHEMA@.activate_tiered_transport_rate() to authenticated;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Legacy flat-rate setter is preserved for explicit FLAT-mode maintenance,
  -- but the production UI uses activate_tiered_transport_rate().
  v_sql := $fn$
create or replace function @SCHEMA@.set_transport_rate(
  p_per_km_rate numeric,
  p_free_distance_km numeric default null
)
returns @SCHEMA@.delivery_settings
language plpgsql
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_actor @SCHEMA@.app_users;
  v_settings @SCHEMA@.delivery_settings;
begin
  select * into v_actor from @SCHEMA@.app_current_actor();
  if v_actor.role <> 'ADMIN' then
    raise exception 'TRANSPORT_RATE_ADMIN_ONLY';
  end if;

  if p_per_km_rate is null or p_per_km_rate < 0 then
    raise exception 'INVALID_PER_KM_RATE';
  end if;
  if p_free_distance_km is not null and p_free_distance_km < 0 then
    raise exception 'INVALID_FREE_DISTANCE';
  end if;

  update @SCHEMA@.delivery_settings
     set rate_model = 'FLAT',
         per_km_rate = p_per_km_rate,
         free_distance_km = coalesce(p_free_distance_km, free_distance_km),
         is_configured = true,
         updated_by = v_actor.id,
         updated_at = now()
   where id = true
  returning * into v_settings;

  return v_settings;
end
$body$;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Clearing disables billing without erasing the approved tier values.
  v_sql := $fn$
create or replace function @SCHEMA@.clear_transport_rate()
returns @SCHEMA@.delivery_settings
language plpgsql
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_actor @SCHEMA@.app_users;
  v_settings @SCHEMA@.delivery_settings;
begin
  select * into v_actor from @SCHEMA@.app_current_actor();
  if v_actor.role <> 'ADMIN' then
    raise exception 'TRANSPORT_RATE_ADMIN_ONLY'
      using detail = 'Only an active Admin can clear the transport rate.';
  end if;

  update @SCHEMA@.delivery_settings
     set per_km_rate = null,
         is_configured = false,
         updated_by = v_actor.id,
         updated_at = now()
   where id = true
  returning * into v_settings;

  return v_settings;
end
$body$;

revoke all on function @SCHEMA@.clear_transport_rate() from public;
grant execute on function @SCHEMA@.clear_transport_rate() to authenticated;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));
end
$migration$;
