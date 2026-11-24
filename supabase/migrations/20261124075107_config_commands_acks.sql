begin;

create table public.temperature_config_versions (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete restrict,
  config_version_no integer not null check (config_version_no >= 1),
  target_min numeric not null,
  target_max numeric not null,
  status text not null check (status in ('approved', 'sent', 'applied', 'failed', 'superseded')),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  issued_at timestamptz not null,
  applied_at timestamptz,
  failure_reason text,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint temperature_config_versions_device_version_key unique (device_id, config_version_no),
  constraint temperature_config_versions_range check (
    -25 <= target_min and target_min < target_max and target_max <= -15
    and target_max - target_min > 1
    and target_min * 2 = trunc(target_min * 2)
    and target_max * 2 = trunc(target_max * 2)
  ),
  constraint temperature_config_versions_failed_reason check (status <> 'failed' or failure_reason is not null),
  constraint temperature_config_versions_applied_time check (status <> 'applied' or applied_at is not null)
);

alter table public.trips add constraint trips_departure_config_version_fk
  foreign key (departure_config_version_id) references public.temperature_config_versions(id) on delete restrict;
alter table public.telemetry_rollups_minute add constraint telemetry_rollups_minute_config_version_fk
  foreign key (config_version_id) references public.temperature_config_versions(id) on delete restrict;

comment on column public.trips.departure_config_version_id is
  'Configuration version selected at departure.';
comment on column public.telemetry_rollups_minute.config_version_id is
  'Configuration version associated with the rollup segment, when known.';

create table public.device_commands (
  id bigint generated always as identity primary key,
  command_id uuid not null unique,
  device_id uuid not null references public.devices(id) on delete restrict,
  trip_id uuid references public.trips(id) on delete restrict,
  type text not null check (type in ('set_target_range', 'set_relay_manual')),
  payload jsonb not null,
  config_version_id uuid references public.temperature_config_versions(id) on delete restrict,
  state text check (state in ('on', 'off')),
  duration_seconds integer check (duration_seconds between 1 and 1800),
  issued_at timestamptz not null,
  expires_at timestamptz not null,
  status text not null check (status in ('queued', 'sent', 'acked_applied', 'acked_rejected', 'timed_out', 'failed')),
  failure_reason text check (failure_reason in ('expired', 'publish_failed', 'device_failed', 'superseded_command', 'internal_error')),
  issued_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint device_commands_expiry check (expires_at = issued_at + interval '30 seconds'),
  constraint device_commands_type_fields check (
    (type = 'set_relay_manual' and state is not null and duration_seconds is not null
      and trip_id is not null and config_version_id is null)
    or (type = 'set_target_range' and config_version_id is not null
      and state is null and duration_seconds is null)
  )
);

create unique index device_commands_one_unfinished_per_device_idx on public.device_commands (device_id)
  where status in ('queued', 'sent');

-- Related records reference the internal bigint PK. The UUID identifies the wire command.
create table public.device_command_attempts (
  id bigint generated always as identity primary key,
  command_id bigint not null references public.device_commands(id) on delete restrict,
  attempt_no integer not null check (attempt_no between 1 and 3),
  sent_at timestamptz,
  result text,
  created_at timestamptz not null default now(),
  constraint device_command_attempts_command_attempt_key unique (command_id, attempt_no)
);

create table public.device_command_acks (
  id bigint generated always as identity primary key,
  ack_id uuid not null,
  command_id bigint not null references public.device_commands(id) on delete restrict,
  device_id uuid not null references public.devices(id) on delete restrict,
  result text not null check (result in ('applied', 'rejected', 'failed')),
  reason text,
  retry_after_seconds integer check (retry_after_seconds >= 0),
  received_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb,
  constraint device_command_acks_device_ack_key unique (device_id, ack_id)
);

alter table public.temperature_config_versions enable row level security;
alter table public.device_commands enable row level security;
alter table public.device_command_attempts enable row level security;
alter table public.device_command_acks enable row level security;

revoke all on public.temperature_config_versions, public.device_commands,
  public.device_command_attempts, public.device_command_acks from public, anon, authenticated;
revoke all on sequence public.device_commands_id_seq, public.device_command_attempts_id_seq,
  public.device_command_acks_id_seq from public, anon, authenticated;

grant select on public.temperature_config_versions, public.device_commands to authenticated;
grant select, insert, update, delete on public.temperature_config_versions, public.device_commands,
  public.device_command_attempts, public.device_command_acks to service_role;
grant usage on sequence public.device_commands_id_seq, public.device_command_attempts_id_seq,
  public.device_command_acks_id_seq to service_role;

create policy temperature_config_versions_admin_read on public.temperature_config_versions for select to authenticated
  using ((select public.current_account_role()) = 'admin');

create policy device_commands_scoped_read on public.device_commands for select to authenticated
  using ((select public.current_account_role()) = 'admin' or (
    (select public.current_account_role()) = 'driver' and exists (
      select 1 from public.trips t where t.id = device_commands.trip_id and t.driver_id = (select auth.uid())
    )
  ));

commit;
