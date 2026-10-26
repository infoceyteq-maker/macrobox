-- Read-only directory helpers for the live POS/Admin UI.
-- These expose only active Drivers/Customers to operational staff, avoiding a
-- broad RLS read grant on the whole app_users table.

create or replace function macrobox_pos.list_active_drivers()
returns table (id uuid, name text, email text)
language plpgsql
security definer
set search_path = macrobox_pos, pg_temp
as $$
begin
  if not macrobox_pos.app_has_role(array['ADMIN','MANAGER','FRONT_DESK']::macrobox_pos.app_role[]) then
    raise exception 'DIRECTORY_ACCESS_DENIED';
  end if;

  return query
  select au.id, au.name, au.email
  from macrobox_pos.app_users au
  where au.role = 'DRIVER' and au.status = 'ACTIVE'
  order by au.name;
end $$;

create or replace function macrobox_pos.list_active_customers()
returns table (id uuid, name text, email text)
language plpgsql
security definer
set search_path = macrobox_pos, pg_temp
as $$
begin
  if not macrobox_pos.app_has_role(array['ADMIN','MANAGER','FRONT_DESK']::macrobox_pos.app_role[]) then
    raise exception 'DIRECTORY_ACCESS_DENIED';
  end if;

  return query
  select au.id, au.name, au.email
  from macrobox_pos.app_users au
  where au.role = 'CUSTOMER' and au.status = 'ACTIVE'
  order by au.name;
end $$;

revoke all on function macrobox_pos.list_active_drivers() from public;
revoke all on function macrobox_pos.list_active_customers() from public;
grant execute on function macrobox_pos.list_active_drivers() to authenticated;
grant execute on function macrobox_pos.list_active_customers() to authenticated;
