-- Apply the core POS migration into an isolated `macrobox_pos` schema.
-- Used on the connected Umbrellacafe project because its `public.orders`
-- table already contains unrelated legacy data. No existing public table is
-- renamed, dropped, or modified.
--
-- The core SQL is fetched from the repository branch so this migration stays
-- in lockstep with 202610270001_pos_core.sql.

create extension if not exists pgcrypto;
create extension if not exists http with schema extensions;

do $$
declare
  v_sql text;
  v_status int;
begin
  select status, content into v_status, v_sql
  from extensions.http_get(
    'https://raw.githubusercontent.com/infoceyteq-maker/macrobox/arena/bba9033f-macrobox/supabase/migrations/202610270001_pos_core.sql'
  );

  if v_status <> 200 or v_sql is null then
    raise exception 'Unable to fetch POS migration (status %)', v_status;
  end if;

  v_sql := replace(v_sql, 'create extension if not exists pgcrypto;', '');
  v_sql := replace(v_sql, 'set search_path = public, pg_temp', 'set search_path = macrobox_pos, pg_temp');
  v_sql := replace(v_sql, 'public.', 'macrobox_pos.');
  v_sql := replace(
    v_sql,
    'drop trigger if exists on_auth_user_created on auth.users;',
    'drop trigger if exists on_auth_user_created_macrobox_pos on auth.users;'
  );
  v_sql := replace(
    v_sql,
    'create trigger on_auth_user_created',
    'create trigger on_auth_user_created_macrobox_pos'
  );

  execute 'create schema if not exists macrobox_pos;';
  execute v_sql;
  execute 'grant usage on schema macrobox_pos to anon, authenticated, service_role;';
  execute 'grant all on all tables in schema macrobox_pos to service_role;';
  execute 'grant all on all sequences in schema macrobox_pos to service_role;';
  execute 'grant all on all routines in schema macrobox_pos to service_role;';
end $$;
