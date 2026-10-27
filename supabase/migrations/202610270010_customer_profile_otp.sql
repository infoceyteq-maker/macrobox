-- Passwordless customer auth: profile fields, OTP-created profiles, and
-- customer-owned profile updates. Supports `public` and `macrobox_pos`.

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

  execute format($ddl$
    alter table %I.app_users
      add column if not exists delivery_address text,
      add column if not exists delivery_notes text,
      add column if not exists profile_completed_at timestamptz;
  $ddl$, v_schema);

  -- Phone-OTP users may have no email. Use the verified phone as the initial
  -- display name so the profile is never an unusable placeholder.
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
    nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
    nullif(v_phone, ''),
    'MacroBox Customer'
  );
begin
  insert into @SCHEMA@.app_users (id, role, name, email, phone)
  values ((v_new ->> 'id')::uuid, 'CUSTOMER', v_name, v_email, v_phone)
  on conflict (id) do update
    set phone = coalesce(@SCHEMA@.app_users.phone, excluded.phone),
        email = coalesce(@SCHEMA@.app_users.email, excluded.email),
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

  -- Sync email/phone/name changes made by Supabase Auth magic links or user
  -- metadata updates back into the POS customer profile.
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
  v_name text := nullif(v_meta ->> 'name', '');
begin
  update @SCHEMA@.app_users
     set email = coalesce(v_email, email),
         phone = coalesce(v_phone, phone),
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

drop trigger if exists on_auth_user_updated_customer_profile on auth.users;
create trigger on_auth_user_updated_customer_profile
after update on auth.users
for each row execute function @SCHEMA@.sync_auth_user_profile();
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Service-role guard used after a successful OTP verification. It is
  -- idempotent and never downgrades an existing staff/admin role.
  v_sql := $fn$
create or replace function @SCHEMA@.ensure_customer_profile(
  p_user_id uuid,
  p_email text default null,
  p_phone text default null,
  p_name text default null
)
returns void
language plpgsql
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_name text := coalesce(nullif(btrim(coalesce(p_name, '')), ''), nullif(p_phone, ''), 'MacroBox Customer');
begin
  insert into @SCHEMA@.app_users (id, role, name, email, phone, status)
  values (p_user_id, 'CUSTOMER', v_name, nullif(p_email, ''), nullif(p_phone, ''), 'ACTIVE')
  on conflict (id) do update
    set email = coalesce(@SCHEMA@.app_users.email, excluded.email),
        phone = coalesce(@SCHEMA@.app_users.phone, excluded.phone);
end
$body$;

revoke all on function @SCHEMA@.ensure_customer_profile(uuid, text, text, text)
  from public, anon, authenticated;
grant execute on function @SCHEMA@.ensure_customer_profile(uuid, text, text, text)
  to service_role;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Customers can update only their own non-privileged profile fields. Role,
  -- status, salary, and other users remain protected by RLS/rpc boundary.
  v_sql := $fn$
create or replace function @SCHEMA@.update_customer_profile(
  p_name text default '',
  p_delivery_address text default '',
  p_delivery_notes text default ''
)
returns @SCHEMA@.app_users
language plpgsql
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
declare
  v_actor @SCHEMA@.app_users;
  v_profile @SCHEMA@.app_users;
begin
  select * into v_actor from @SCHEMA@.app_current_actor();
  if v_actor.role <> 'CUSTOMER' then
    raise exception 'FORBIDDEN';
  end if;

  update @SCHEMA@.app_users
     set name = coalesce(nullif(btrim(coalesce(p_name, '')), ''), name),
         delivery_address = nullif(btrim(coalesce(p_delivery_address, '')), ''),
         delivery_notes = nullif(btrim(coalesce(p_delivery_notes, '')), ''),
         profile_completed_at = now(),
         updated_at = now()
   where id = v_actor.id
  returning * into v_profile;

  return v_profile;
end
$body$;

revoke all on function @SCHEMA@.update_customer_profile(text, text, text)
  from public, anon;
grant execute on function @SCHEMA@.update_customer_profile(text, text, text)
  to authenticated;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));
end
$migration$;

notify pgrst, 'reload schema';
