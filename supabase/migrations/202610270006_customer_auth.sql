-- Customer authentication: store the phone number supplied at registration and
-- provide a server-only lookup so a customer can sign in with either their
-- email address or their E.164 phone number. This supports both `public` and
-- the connected project's isolated `macrobox_pos` layout without touching
-- unrelated auth triggers or legacy public data.

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

  -- Replacing the POS trigger function makes the existing after-insert trigger
  -- copy both auth.users.phone and raw_user_meta_data.phone into the profile.
  -- to_jsonb(new) keeps the function valid in the local PGlite auth shim,
  -- which intentionally has a smaller auth.users table.
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
  -- GoTrue stores auth.users.phone without the leading plus; the supplied
  -- metadata preserves the E.164 form, so prefer metadata when available.
  v_phone text := coalesce(nullif(v_meta ->> 'phone', ''), nullif(v_new ->> 'phone', ''));
  v_name text := coalesce(
    nullif(v_meta ->> 'name', ''),
    nullif(split_part(coalesce(v_email, ''), '@', 1), ''),
    'New user'
  );
begin
  insert into @SCHEMA@.app_users (id, role, name, email, phone)
  values ((v_new ->> 'id')::uuid, 'CUSTOMER', v_name, v_email, v_phone)
  on conflict (id) do update
    set phone = coalesce(@SCHEMA@.app_users.phone, excluded.phone),
        email = coalesce(@SCHEMA@.app_users.email, excluded.email);

  return new;
end
$body$;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Normalised E.164 phone numbers are unique among active customer profiles.
  execute format($idx$
    create unique index if not exists app_users_customer_phone_unique_idx
    on %I.app_users (regexp_replace(phone, '[^0-9]', '', 'g'))
    where phone is not null and phone <> '' and role = 'CUSTOMER'
  $idx$, v_schema);

  -- Only the server-side service-role client may translate a phone number into
  -- the corresponding Supabase Auth email. The browser never receives this RPC.
  v_sql := $fn$
create or replace function @SCHEMA@.find_customer_signin_email(p_phone text)
returns text
language sql
stable
security definer
set search_path = @SCHEMA@, pg_temp
as $body$
  select lower(u.email)
  from @SCHEMA@.app_users a
  join auth.users u on u.id = a.id
  where a.role = 'CUSTOMER'
    and a.status = 'ACTIVE'
    and a.phone is not null
    and regexp_replace(a.phone, '[^0-9]', '', 'g')
      = regexp_replace(coalesce(p_phone, ''), '[^0-9]', '', 'g')
    and u.email is not null
  limit 1
$body$;

revoke all on function @SCHEMA@.find_customer_signin_email(text)
  from public, anon, authenticated;
grant execute on function @SCHEMA@.find_customer_signin_email(text)
  to service_role;
  $fn$;
  execute replace(v_sql, '@SCHEMA@', quote_ident(v_schema));

  -- Backfill profiles created before this migration when Auth already had a
  -- phone value. to_jsonb avoids depending on optional auth.users columns.
  execute format($sync$
    update %I.app_users a
       set phone = coalesce(
         a.phone,
         nullif(coalesce(to_jsonb(u) -> 'raw_user_meta_data', '{}'::jsonb) ->> 'phone', ''),
         nullif(to_jsonb(u) ->> 'phone', '')
       )
      from auth.users u
     where a.id = u.id
       and a.phone is null
  $sync$, v_schema);
end
$migration$;
