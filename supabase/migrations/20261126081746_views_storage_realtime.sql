begin;

create view public.customer_shipments_view with (security_invoker = true) as
  select s.id, s.product_type, s.temp_min, s.temp_max, s.status, s.created_at
  from public.shipments s
  where s.customer_id = (select auth.uid())
    and (select public.current_account_role()) = 'customer';

-- NULL requests the caller's own trip list for the invoker view below.
create function private.customer_trip_summary(p_trip_id uuid)
returns table (
  trip_id uuid, shipment_id uuid, status text, departed_at timestamptz,
  completed_at timestamptz, total_duration_seconds numeric, total_distance_km double precision
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.shipment_id, t.status, t.departed_at, t.completed_at,
    case when t.status = 'completed' then extract(epoch from t.completed_at - t.departed_at) end,
    case when t.status = 'completed' then (
      select case when count(*) > 0 then coalesce(sum(
        2 * 6371.0088 * asin(sqrt(least(1.0, greatest(0.0,
          power(sin((p.lat_rad - p.previous_lat_rad) / 2), 2)
          + cos(p.previous_lat_rad) * cos(p.lat_rad) * power(sin((p.lng_rad - p.previous_lng_rad) / 2), 2)
        ))))
      ) filter (where p.previous_lat_rad is not null), 0.0) end
      from (
        select radians(r.lat::double precision) as lat_rad,
          radians(r.lng::double precision) as lng_rad,
          lag(radians(r.lat::double precision)) over gps_order as previous_lat_rad,
          lag(radians(r.lng::double precision)) over gps_order as previous_lng_rad
        from public.telemetry_readings r
        where r.trip_id = t.id and r.gps_fix
          and r.lat is not null and r.lng is not null and r.measured_at_device is not null
        window gps_order as (order by r.measured_at_device, r.id)
      ) p
    ) end
  from public.trips t
  join public.shipments s on s.id = t.shipment_id
  where (p_trip_id is null or t.id = p_trip_id)
    and s.deleted_at is null and s.customer_id = (select auth.uid())
    and (select public.current_account_role()) = 'customer';
$$;

create function private.customer_live_gps(p_trip_id uuid)
returns table (trip_id uuid, lat numeric, lng numeric, measured_at_device timestamptz)
language sql stable security definer set search_path = '' as $$
  select t.id, r.lat, r.lng, r.measured_at_device
  from public.trips t
  join public.shipments s on s.id = t.shipment_id
  join public.telemetry_readings r on r.trip_id = t.id
  where t.id = p_trip_id and t.status = 'in_transit'
    and s.deleted_at is null and s.customer_id = (select auth.uid())
    and (select public.current_account_role()) = 'customer'
    and r.gps_fix and r.lat is not null and r.lng is not null and r.measured_at_device is not null
  order by r.measured_at_device desc, r.id desc
  limit 1;
$$;

create function private.driver_trips()
returns table (
  trip_id uuid, status text, departed_at timestamptz, completed_at timestamptz,
  driver_notes text, plate text, product_type text, temp_min numeric, temp_max numeric, warehouse_notes text
)
language sql stable security definer set search_path = '' as $$
  select t.id, t.status, t.departed_at, t.completed_at, t.driver_notes,
    v.plate, s.product_type, s.temp_min, s.temp_max, s.warehouse_notes
  from public.trips t
  join public.vehicles v on v.id = t.vehicle_id
  join public.shipments s on s.id = t.shipment_id
  where t.driver_id = (select auth.uid())
    and (select public.current_account_role()) = 'driver';
$$;

revoke all on function private.customer_trip_summary(uuid), private.customer_live_gps(uuid), private.driver_trips()
  from public, anon, authenticated, service_role;
grant execute on function private.customer_trip_summary(uuid), private.customer_live_gps(uuid), private.driver_trips()
  to authenticated;

-- View definitions bind the private functions without exposing the private schema to clients.
create view public.customer_trips_view with (security_invoker = true) as
  select t.trip_id, t.shipment_id, t.status, t.departed_at, t.completed_at,
    t.total_duration_seconds, t.total_distance_km
  from private.customer_trip_summary(null::uuid) t;

create view public.driver_trips_view with (security_invoker = true) as
  select t.trip_id, t.status, t.departed_at, t.completed_at, t.driver_notes,
    t.plate, t.product_type, t.temp_min, t.temp_max, t.warehouse_notes
  from private.driver_trips() t;

revoke all on public.customer_shipments_view, public.customer_trips_view, public.driver_trips_view
  from public, anon, authenticated;
grant select on public.customer_shipments_view, public.customer_trips_view, public.driver_trips_view
  to authenticated;

insert into storage.buckets (id, name, public)
values ('delivery-proofs', 'delivery-proofs', false);

-- Supabase Postgres Changes cannot apply RLS to DELETE events.
alter publication supabase_realtime set (publish = 'insert, update');
alter publication supabase_realtime add table public.notifications, public.alerts;

commit;
