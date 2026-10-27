-- GoTrue strips the leading `+` from auth.users.phone. Normalise customer
-- phone matching to digits only and prefer the E.164 value saved in user
-- metadata. This migration is safe to apply after 202610270006_customer_auth.

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

  -- The previous index expression retained `+`; replace it with a digits-only
  -- expression so +94771234567 and 94771234567 resolve to the same account.
  execute format('drop index if exists %I.app_users_customer_phone_unique_idx', v_schema);
  execute format($idx$
    create unique index if not exists app_users_customer_phone_unique_idx
    on %I.app_users (regexp_replace(phone, '[^0-9]', '', 'g'))
    where phone is not null and phone <> '' and role = 'CUSTOMER'
  $idx$, v_schema);

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

  execute format($sync$
    update %I.app_users a
       set phone = nullif(coalesce(to_jsonb(u) -> 'raw_user_meta_data', '{}'::jsonb) ->> 'phone', '')
      from auth.users u
     where a.id = u.id
       and a.role = 'CUSTOMER'
       and a.phone is not null
       and nullif(coalesce(to_jsonb(u) -> 'raw_user_meta_data', '{}'::jsonb) ->> 'phone', '') is not null
       and a.phone <> nullif(coalesce(to_jsonb(u) -> 'raw_user_meta_data', '{}'::jsonb) ->> 'phone', '')
  $sync$, v_schema);
end
$migration$;
