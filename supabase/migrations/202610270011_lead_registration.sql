-- Lead registration: capture the name / delivery city collected on the
-- registration screen (stored in Supabase Auth user metadata by the OTP
-- request) into the POS customer profile. Supports `public` and
-- `macrobox_pos`, matching the dynamic-schema pattern of earlier migrations.
--
-- The lead email is intentionally NOT copied into app_users.email: it is
-- unverified lead contact data kept in Auth metadata (`lead_email`), while
-- the profile email column is reserved for the verified magic-link flow.

do $migration$
declare
  v_schema text;
  v_sql text;
begin
  if to_regclass('macrobox_pos.app_users') is not null then
    v_schema := 'macrobox_pos';
  elsif to_regclass('public.app_users') is not null then
    v_schema := 'public';
  else
    raise exception 'POS app_users table was not found';
  end if;

  -- New OTP users: prefer metadata `name`, fall back to `full_name`, and
  -- seed the delivery address from the registration city when provided.
  v_sql := $fn$
create or replace function @SCHEMA@.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_new jsonb := to_jsonb(new);
  v_meta jsonb := coalesce(v_new -> 'raw_user_meta_data', '{}'::jsonb);
  v_email text := nullif(v_new ->> 'email', '');
  v_phone text := coalesce(nullif(v_meta ->> 'phone', ''), nullif(v_new ->> 'phone', ''));
  v_name text := coalesce(
    nullif(v_meta ->> 'name', ''),
    nullif(v_meta ->> 'full_name', ''),
    nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
    nullif(v_phone, ''),
    'MacroBox Customer'
  );
  v_location text := coalesce(
    nullif(btrim(v_meta ->> 'location'), ''),
    nullif(btrim(v_meta ->> 'delivery_location'), ''),
    nullif(btrim(v_meta ->> 'delivery_city'), '')
  );
begin
  insert into @SCHEMA@.app_users (id, role, name, email, phone, delivery_address)
  values ((v_new ->> 'id')::uuid, 'CUSTOMER', v_name, v_email, v_phone, v_location)
  on conflict (id) do update
    set phone = coalesce(@SCHEMA@.app_users.phone, excluded.phone),
        email = coalesce(@SCHEMA@.app_users.email, excluded.email),
        delivery_address = coalesce(@SCHEMA@.app_users.delivery_address, excluded.delivery_address),
        name = case
          when @SCHEMA@.app_users.name in ('New user', 'MacroBox Customer')
            then excluded.name
          else @SCHEMA@.app_users.name
        end;

  return new;
end
$body$;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Auth metadata updates (magic link, profile sync): fill name/city only
  -- when the profile still holds a placeholder / empty value, so a fuller
  -- address saved later in My Profile is never overwritten by the city.
  v_sql := $fn$
create or replace function @SCHEMA@.sync_auth_user_profile()
returns trigger
language plpgsql
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_new jsonb := to_jsonb(new);
  v_meta jsonb := coalesce(v_new -> 'raw_user_meta_data', '{}'::jsonb);
  v_email text := nullif(v_new ->> 'email', '');
  v_phone text := coalesce(nullif(v_meta ->> 'phone', ''), nullif(v_new ->> 'phone', ''));
  v_name text := coalesce(nullif(v_meta ->> 'name', ''), nullif(v_meta ->> 'full_name', ''));
  v_location text := coalesce(
    nullif(btrim(v_meta ->> 'location'), ''),
    nullif(btrim(v_meta ->> 'delivery_location'), ''),
    nullif(btrim(v_meta ->> 'delivery_city'), '')
  );
begin
  update @SCHEMA@.app_users
     set email = coalesce(v_email, email),
         phone = coalesce(v_phone, phone),
         delivery_address = coalesce(delivery_address, v_location),
         name = case
           when v_name is not null then v_name
           when name in ('New user', 'MacroBox Customer') and v_phone is not null then v_phone
           else name
         end,
         updated_at = now()
   where id = (v_new ->> 'id')::uuid;

  return new;
end
$body$;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));
end
$migration$;

notify pgrst, 'reload schema';
