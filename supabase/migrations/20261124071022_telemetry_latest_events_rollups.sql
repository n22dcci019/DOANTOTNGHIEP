begin;

create table public.telemetry_readings (
  id bigint generated always as identity primary key,
  message_id uuid not null unique,
  device_id uuid not null references public.devices(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete restrict,
  session_id uuid references public.device_sessions(id) on delete restrict,
  boot_id uuid not null,
  sequence_no bigint not null,
  monotonic_ms bigint not null,
  measured_at_device timestamptz,
  time_source text not null check (time_source in ('gps', 'ntp', 'unknown')),
  time_quality text not null check (time_quality in ('good', 'unknown')),
  received_at timestamptz not null,
  is_backfill boolean not null default false,
  temperature_c numeric,
  humidity_pct numeric,
  out_of_range boolean not null default false,
  door_open boolean,
  gps_fix boolean not null default false,
  lat numeric check (lat between -90 and 90),
  lng numeric check (lng between -180 and 180),
  sensor_status jsonb,
  config_version_no integer,
  relay_state text check (relay_state in ('on', 'off')),
  control_mode text check (control_mode in ('auto', 'manual')),
  manual_expires_at timestamptz,
  constraint telemetry_readings_device_boot_sequence_key unique (device_id, boot_id, sequence_no),
  constraint telemetry_readings_time_consistency check (time_source <> 'unknown' or time_quality = 'unknown'),
  constraint telemetry_readings_manual_deadline check (
    (control_mode <> 'manual' or manual_expires_at is not null)
    and (control_mode <> 'auto' or manual_expires_at is null)
  )
);

create index telemetry_readings_device_received_at_idx on public.telemetry_readings (device_id, received_at);
create index telemetry_readings_trip_measured_at_idx on public.telemetry_readings (trip_id, measured_at_device);

create table public.device_latest_state (
  device_id uuid primary key references public.devices(id) on delete restrict,
  active_boot_id uuid,
  last_sequence_no bigint,
  last_received_at timestamptz,
  last_fresh_sample_at timestamptz,
  temperature_c numeric,
  humidity_pct numeric,
  door_open boolean,
  gps_fix boolean not null default false,
  lat numeric check (lat between -90 and 90),
  lng numeric check (lng between -180 and 180),
  relay_state text check (relay_state in ('on', 'off')),
  control_mode text check (control_mode in ('auto', 'manual')),
  manual_expires_at timestamptz,
  config_version_no integer,
  updated_at timestamptz not null,
  constraint device_latest_state_manual_deadline check (
    (control_mode <> 'manual' or manual_expires_at is not null)
    and (control_mode <> 'auto' or manual_expires_at is null)
  )
);

create table public.device_events (
  id bigint generated always as identity primary key,
  event_id uuid not null unique,
  device_id uuid not null references public.devices(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete restrict,
  type text not null check (type ~ '[^[:space:]]'),
  measured_at timestamptz,
  received_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create index device_events_device_received_at_idx on public.device_events (device_id, received_at);
create index device_events_trip_id_idx on public.device_events (trip_id);

create table public.telemetry_rollups_minute (
  id bigint generated always as identity primary key,
  device_id uuid not null references public.devices(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete restrict,
  config_version_id uuid,
  minute_utc timestamptz not null,
  window_seconds integer not null check (window_seconds between 0 and 60),
  covered_seconds integer not null check (covered_seconds between 0 and 60),
  missing_seconds integer not null check (missing_seconds between 0 and 60),
  sample_count integer not null,
  valid_sample_count integer not null,
  temp_min numeric,
  temp_max numeric,
  temp_avg numeric,
  humidity_avg numeric,
  door_open_seconds integer not null default 0 check (door_open_seconds between 0 and 60),
  constraint telemetry_rollups_minute_key unique nulls not distinct (device_id, trip_id, config_version_id, minute_utc),
  constraint telemetry_rollups_utc_minute check (date_trunc('minute', minute_utc, 'UTC') = minute_utc),
  constraint telemetry_rollups_coverage check (covered_seconds + missing_seconds = window_seconds),
  constraint telemetry_rollups_sample_counts check (valid_sample_count <= sample_count),
  constraint telemetry_rollups_temp_order check (temp_min <= temp_avg and temp_avg <= temp_max and temp_min <= temp_max)
);

create index telemetry_rollups_trip_minute_idx on public.telemetry_rollups_minute (trip_id, minute_utc);
create index telemetry_rollups_device_minute_idx on public.telemetry_rollups_minute (device_id, minute_utc);

alter table public.telemetry_readings enable row level security;
alter table public.device_latest_state enable row level security;
alter table public.device_events enable row level security;
alter table public.telemetry_rollups_minute enable row level security;

revoke all on public.telemetry_readings, public.device_latest_state, public.device_events,
  public.telemetry_rollups_minute from public, anon, authenticated;
revoke all on sequence public.telemetry_readings_id_seq, public.device_events_id_seq,
  public.telemetry_rollups_minute_id_seq from public, anon, authenticated;

grant select on public.telemetry_readings, public.device_latest_state, public.device_events,
  public.telemetry_rollups_minute to authenticated;
grant select, insert, update, delete on public.telemetry_readings, public.device_latest_state,
  public.device_events, public.telemetry_rollups_minute to service_role;
grant usage on sequence public.telemetry_readings_id_seq, public.device_events_id_seq,
  public.telemetry_rollups_minute_id_seq to service_role;

create policy telemetry_readings_scoped_read on public.telemetry_readings for select to authenticated
  using ((select public.has_permission('telemetry.read')) and (
    (select public.current_account_role()) = 'admin'
    or ((select public.current_account_role()) = 'driver' and exists (
      select 1 from public.trips t where t.id = telemetry_readings.trip_id and t.driver_id = (select auth.uid())
    ))
  ));

create policy device_latest_state_admin_read on public.device_latest_state for select to authenticated
  using ((select public.current_account_role()) = 'admin' and (select public.has_permission('telemetry.read')));

create policy device_events_scoped_read on public.device_events for select to authenticated
  using ((select public.has_permission('telemetry.read')) and (
    (select public.current_account_role()) = 'admin'
    or ((select public.current_account_role()) = 'driver' and exists (
      select 1 from public.trips t where t.id = device_events.trip_id and t.driver_id = (select auth.uid())
    ))
  ));

create policy telemetry_rollups_scoped_read on public.telemetry_rollups_minute for select to authenticated
  using ((select public.has_permission('telemetry.read')) and (
    (select public.current_account_role()) = 'admin'
    or ((select public.current_account_role()) = 'driver' and exists (
      select 1 from public.trips t where t.id = telemetry_rollups_minute.trip_id and t.driver_id = (select auth.uid())
    ))
  ));

comment on column public.telemetry_readings.out_of_range is
  'Ingest supplies this flag for temperatures outside [-30,10] Celsius while preserving the reading.';
comment on column public.telemetry_rollups_minute.config_version_id is
  'Foreign key deferred to the temperature configurations migration in step 1.5.';

commit;
