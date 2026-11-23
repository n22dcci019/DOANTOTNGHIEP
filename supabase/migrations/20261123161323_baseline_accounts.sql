begin;

create table public.roles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique check (code in ('admin', 'customer', 'driver')),
  name text not null
);
create table public.permissions (
  id uuid primary key default gen_random_uuid(),
  code text not null unique
);
create table public.role_permissions (
  role_id uuid not null references public.roles(id) on delete restrict,
  permission_id uuid not null references public.permissions(id) on delete restrict,
  primary key (role_id, permission_id)
);
create table public.profiles (
  id uuid primary key references auth.users(id) on delete restrict,
  full_name text,
  phone text,
  email text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.account_access (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references public.profiles(id) on delete restrict,
  role_id uuid not null references public.roles(id) on delete restrict,
  status text not null default 'pending' check (status in ('active', 'pending', 'suspended')),
  activated_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  version integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- System reference data, not demo users or business data.
insert into public.roles (code, name) values
  ('admin', 'Admin'), ('customer', 'Customer'), ('driver', 'Driver');

-- Permissions express capabilities only. Ownership/trip scope/status must also
-- be checked by later API/RLS steps; these codes do not grant table writes.
with capabilities(role_code, codes) as (values
  ('admin', array[
    'shipments.read','shipments.approve','shipments.reject','shipments.assign','shipments.cancel',
    'trips.read','trips.assign','trips.cancel','delivery_proofs.read',
    'telemetry.read','gps.read','temperature_configs.create','relay.control',
    'alerts.read','alerts.acknowledge','alerts.resolve',
    'vehicles.read','vehicles.manage','devices.read','devices.manage','device_credentials.manage',
    'profiles.read','profiles.update','notifications.read','notifications.mark_read'
  ]),
  ('customer', array[
    'shipments.read','shipments.create','shipments.update','shipments.submit','shipments.cancel',
    'trips.read','delivery_proofs.read','telemetry.read','gps.read','alerts.read',
    'profiles.read','profiles.update','notifications.read','notifications.mark_read'
  ]),
  ('driver', array[
    'shipments.read','trips.read','trips.depart','trips.complete','trips.update_notes',
    'delivery_proofs.read','delivery_proofs.upload','telemetry.read','gps.read',
    'alerts.read','alerts.acknowledge','vehicles.read','devices.read',
    'profiles.read','profiles.update','notifications.read','notifications.mark_read'
  ])
), expanded as (
  select role_code, unnest(codes) as code from capabilities
), inserted as (
  insert into public.permissions (code) select distinct code from expanded
  returning id, code
)
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id from expanded e
join public.roles r on r.code = e.role_code
join inserted p on p.code = e.code;

create function public.current_account_role() returns text
language sql stable security definer set search_path = ''
as $$
  select r.code from public.account_access a
  join public.roles r on r.id = a.role_id
  where a.user_id = auth.uid() and a.status = 'active'
$$;

create function public.has_permission(code text) returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (
    select 1 from public.account_access a
    join public.role_permissions rp on rp.role_id = a.role_id
    join public.permissions p on p.id = rp.permission_id
    where a.user_id = auth.uid() and a.status = 'active' and p.code = $1
  )
$$;

-- The owner is the migration's privileged postgres role, avoiding RLS recursion.
revoke all on function public.current_account_role() from public, anon, authenticated;
revoke all on function public.has_permission(text) from public, anon, authenticated;
grant execute on function public.current_account_role(), public.has_permission(text)
  to authenticated, service_role;

create function public.set_account_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at = now();
  return new;
end;
$$;
revoke all on function public.set_account_updated_at() from public, anon, authenticated;
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_account_updated_at();
create trigger account_access_updated_at before update on public.account_access
  for each row execute function public.set_account_updated_at();

alter table public.roles enable row level security;
alter table public.permissions enable row level security;
alter table public.role_permissions enable row level security;
alter table public.profiles enable row level security;
alter table public.account_access enable row level security;

revoke all on public.roles, public.permissions, public.role_permissions,
  public.profiles, public.account_access from public, anon, authenticated;
grant select on public.roles, public.permissions, public.role_permissions,
  public.profiles, public.account_access to authenticated;
grant all on public.roles, public.permissions, public.role_permissions,
  public.profiles, public.account_access to service_role;

create policy roles_active_read on public.roles for select to authenticated
  using ((select public.current_account_role()) is not null);
create policy permissions_active_read on public.permissions for select to authenticated
  using ((select public.current_account_role()) is not null);
create policy role_permissions_active_read on public.role_permissions for select to authenticated
  using ((select public.current_account_role()) is not null);
create policy profiles_active_read on public.profiles for select to authenticated
  using (
    (select public.current_account_role()) = 'admin'
    or (id = (select auth.uid()) and (select public.current_account_role()) is not null)
  );
-- Pending/suspended may inspect their own access status, but not profiles.
create policy account_access_self_read on public.account_access for select to authenticated
  using (user_id = (select auth.uid()));

comment on table public.profiles is
  'Client SELECT only; profile updates go through PATCH /me in step 2.2.';
comment on function public.current_account_role() is
  'Active database-backed role only. Pending/suspended/missing access returns NULL.';
comment on function public.has_permission(text) is
  'Active role capability only; does not replace ownership/status checks.';

commit;
