begin;

create table public.vehicles (
  id uuid primary key default gen_random_uuid(),
  plate text unique not null,
  temp_capacity_min numeric,
  temp_capacity_max numeric,
  payload_kg numeric,
  status text not null default 'active' check (status in ('active', 'maintenance', 'inactive')),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (temp_capacity_min is null or temp_capacity_max is null or temp_capacity_min < temp_capacity_max)
);

create table public.devices (
  id uuid primary key default gen_random_uuid(),
  device_code text unique not null,
  vehicle_id uuid references public.vehicles(id) on delete restrict,
  is_simulated boolean not null default false,
  status text not null default 'active' check (status in ('active', 'disabled', 'retired')),
  last_seen_at timestamptz,
  next_config_version_no integer not null default 1 check (next_config_version_no >= 1),
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.device_credentials (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete restrict,
  credential_hash text not null,
  active boolean not null,
  revoked_at timestamptz,
  provisioning_status text,
  created_at timestamptz not null default now(),
  -- mosquitto_passwd sha512-pbkdf2: $7$iterations$base64(salt)$base64(digest).
  -- Mosquitto 2.0 uses 12-byte salts, newer versions use 64-byte salts.
  -- Accept both with a 64-byte SHA512 derived key; reject plaintext.
  constraint device_credentials_hash_format check (
    credential_hash ~ '^\$7\$[1-9][0-9]*\$([A-Za-z0-9+/]{16}|[A-Za-z0-9+/]{86}==)\$[A-Za-z0-9+/]{86}==$'
  )
);
create unique index device_credentials_one_active
  on public.device_credentials (device_id) where active;

create table public.device_assignments (
  id uuid primary key default gen_random_uuid(),
  device_id uuid not null references public.devices(id) on delete restrict,
  vehicle_id uuid not null references public.vehicles(id) on delete restrict,
  valid_from timestamptz not null,
  valid_to timestamptz,
  check (valid_to is null or valid_to > valid_from)
);
create unique index device_assignments_one_open_device
  on public.device_assignments (device_id) where valid_to is null;
create unique index device_assignments_one_open_vehicle
  on public.device_assignments (vehicle_id) where valid_to is null;

create trigger vehicles_updated_at before update on public.vehicles
  for each row execute function public.set_account_updated_at();
create trigger devices_updated_at before update on public.devices
  for each row execute function public.set_account_updated_at();

alter table public.vehicles enable row level security;
alter table public.devices enable row level security;
alter table public.device_credentials enable row level security;
alter table public.device_assignments enable row level security;

revoke all on public.vehicles, public.devices, public.device_credentials,
  public.device_assignments from public, anon, authenticated;
grant select on public.vehicles, public.devices, public.device_assignments to authenticated;
grant all on public.vehicles, public.devices, public.device_credentials,
  public.device_assignments to service_role;

-- Role check is required even though 1.1 grants read capabilities to drivers:
-- their scope depends on trips, which will be implemented in steps 1.3/1.7.
create policy vehicles_admin_read on public.vehicles for select to authenticated
  using ((select public.current_account_role()) = 'admin'
    and (select public.has_permission('vehicles.read')));
create policy devices_admin_read on public.devices for select to authenticated
  using ((select public.current_account_role()) = 'admin'
    and (select public.has_permission('devices.read')));
create policy device_assignments_admin_read on public.device_assignments for select to authenticated
  using ((select public.current_account_role()) = 'admin'
    and (select public.has_permission('vehicles.read'))
    and (select public.has_permission('devices.read')));
-- No client SELECT grant or policy on credentials, including for admin.

comment on column public.devices.status is
  'Administrative lifecycle only: active/disabled/retired, never online/offline.';
comment on column public.devices.next_config_version_no is
  'Server-issued monotonic configuration counter; allocation in step 2.5.';
comment on column public.device_credentials.credential_hash is
  'Mosquitto sha512-pbkdf2 $7$ record only; no plaintext credential storage.';
comment on column public.device_credentials.provisioning_status is
  'Provisioning workflow values are deferred to step 1.9; no enum invented here.';
comment on table public.device_assignments is
  'Partial unique indexes prevent duplicate open assignments only; historical interval overlap is not constrained.';
comment on column public.devices.vehicle_id is
  'Current association; server transactions must synchronize this with assignment history in later API steps.';

commit;
