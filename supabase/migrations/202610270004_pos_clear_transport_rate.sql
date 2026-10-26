-- Admin-only control to return dynamic transport billing to "unconfigured".
-- The canonical migration can be installed in either `public` (fresh project)
-- or `macrobox_pos` (isolated deployment); create the RPC in whichever schema
-- actually owns the POS tables.

do $do$
begin
  if to_regclass('public.delivery_settings') is not null then
    execute $fn$
      create or replace function public.clear_transport_rate()
      returns public.delivery_settings
      language plpgsql
      security definer
      set search_path = public, pg_temp
      as $body$
      declare
        v_actor public.app_users;
        v_settings public.delivery_settings;
      begin
        select * into v_actor from public.app_current_actor();
        if v_actor.role <> 'ADMIN' then
          raise exception 'TRANSPORT_RATE_ADMIN_ONLY'
            using detail = 'Only an active Admin can clear the transport rate.';
        end if;

        update public.delivery_settings
           set per_km_rate = null,
               updated_by = v_actor.id,
               updated_at = now()
         where id = true
        returning * into v_settings;

        return v_settings;
      end
      $body$;

      revoke all on function public.clear_transport_rate() from public;
      grant execute on function public.clear_transport_rate() to authenticated;
    $fn$;
  end if;
end
$do$;

do $do$
begin
  if to_regclass('macrobox_pos.delivery_settings') is not null then
    execute $fn$
      create or replace function macrobox_pos.clear_transport_rate()
      returns macrobox_pos.delivery_settings
      language plpgsql
      security definer
      set search_path = macrobox_pos, pg_temp
      as $body$
      declare
        v_actor macrobox_pos.app_users;
        v_settings macrobox_pos.delivery_settings;
      begin
        select * into v_actor from macrobox_pos.app_current_actor();
        if v_actor.role <> 'ADMIN' then
          raise exception 'TRANSPORT_RATE_ADMIN_ONLY'
            using detail = 'Only an active Admin can clear the transport rate.';
        end if;

        update macrobox_pos.delivery_settings
           set per_km_rate = null,
               updated_by = v_actor.id,
               updated_at = now()
         where id = true
        returning * into v_settings;

        return v_settings;
      end
      $body$;

      revoke all on function macrobox_pos.clear_transport_rate() from public;
      grant execute on function macrobox_pos.clear_transport_rate() to authenticated;
    $fn$;
  end if;
end
$do$;
