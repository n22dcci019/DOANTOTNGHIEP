begin;

create table public.shipments (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references public.profiles(id) on delete restrict,
  product_type text not null,
  temp_min numeric not null,
  temp_max numeric not null,
  warehouse_notes text,
  status text not null default 'draft' check (status in
    ('draft','pending_review','approved','rejected','scheduled','in_transit','completed','cancelled')),
  review_note text,
  rejected_reason text,
  reviewed_by uuid references public.profiles(id) on delete restrict,
  reviewed_at timestamptz,
  version integer not null default 1,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (-25 <= temp_min and temp_min < temp_max and temp_max <= -15),
  check (temp_max - temp_min > 1),
  check (temp_min * 2 = trunc(temp_min * 2) and temp_max * 2 = trunc(temp_max * 2)),
  check (status <> 'rejected' or (rejected_reason is not null and length(btrim(rejected_reason)) > 0))
);

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  shipment_id uuid not null references public.shipments(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  driver_id uuid not null references public.profiles(id) on delete restrict,
  device_id uuid not null references public.devices(id) on delete restrict,
  departure_config_version_id uuid,
  status text not null default 'scheduled' check (status in ('scheduled','in_transit','completed','cancelled')),
  departed_at timestamptz,
  completed_at timestamptz,
  driver_notes text,
  manual_off_issued_seconds integer not null default 0 check (manual_off_issued_seconds between 0 and 1200),
  result text check (result in ('pending_evaluation','pass','fail')),
  evaluation_version integer,
  evaluation_details jsonb,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status not in ('in_transit','completed') or departed_at is not null),
  check (status <> 'completed' or completed_at is not null),
  check (completed_at is null or (departed_at is not null and completed_at > departed_at))
);

create unique index trips_one_live_vehicle on public.trips (vehicle_id)
  where status in ('scheduled','in_transit');
create unique index trips_one_live_driver on public.trips (driver_id)
  where status in ('scheduled','in_transit');
create unique index trips_one_live_shipment on public.trips (shipment_id)
  where status in ('scheduled','in_transit');
create unique index trips_one_live_device on public.trips (device_id)
  where status in ('scheduled','in_transit');

create table public.delivery_proofs (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null unique references public.trips(id) on delete restrict,
  photo_path text not null,
  signed_by text,
  received_at timestamptz not null,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now()
);

create table public.device_sessions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete restrict,
  boot_id uuid not null,
  trip_id uuid references public.trips(id) on delete restrict,
  started_at timestamptz,
  ended_at timestamptz,
  start_monotonic_ms bigint,
  end_monotonic_ms bigint,
  created_at timestamptz not null default now(),
  unique (device_id, boot_id),
  check (end_monotonic_ms is null or start_monotonic_ms is null or end_monotonic_ms >= start_monotonic_ms)
);

alter table public.shipments enable row level security;
alter table public.trips enable row level security;
alter table public.delivery_proofs enable row level security;
alter table public.device_sessions enable row level security;

revoke all on public.shipments, public.trips, public.delivery_proofs,
  public.device_sessions from public, anon, authenticated;
grant select on public.shipments, public.trips, public.delivery_proofs to authenticated;
grant all on public.shipments, public.trips, public.delivery_proofs, public.device_sessions to service_role;

create policy shipments_scoped_read on public.shipments for select to authenticated
  using (deleted_at is null and (select public.has_permission('shipments.read')) and (
    (select public.current_account_role()) = 'admin'
    or ((select public.current_account_role()) = 'customer' and customer_id = (select auth.uid()))
  ));
create policy trips_scoped_read on public.trips for select to authenticated
  using ((select public.has_permission('trips.read')) and (
    (select public.current_account_role()) = 'admin'
    or ((select public.current_account_role()) = 'driver' and driver_id = (select auth.uid()))
  ));
create policy delivery_proofs_scoped_read on public.delivery_proofs for select to authenticated
  using ((select public.has_permission('delivery_proofs.read')) and (
    (select public.current_account_role()) = 'admin'
    or ((select public.current_account_role()) = 'driver' and exists (
      select 1 from public.trips t where t.id = delivery_proofs.trip_id and t.driver_id = (select auth.uid())
    ))
  ));
-- Sessions have neither a client SELECT grant nor client policies.
-- No triggers: API transactions in 2.x own transitions and updated_at updates.

comment on column public.trips.departure_config_version_id is
  'FK intentionally deferred until temperature_config_versions exists in step 1.5.';
comment on column public.trips.result is
  'No automatic pass/default result on completion. Evaluation is implemented later.';
comment on column public.delivery_proofs.photo_path is
  'Object path in private Storage, not a public URL. Bucket/view provisioning is step 1.7.';
comment on table public.device_sessions is
  'Server-only boot session; trip_id may remain NULL until attribution is possible. No client reads.';

commit;
