begin;

create schema private;

create table public.alerts (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips(id) on delete restrict,
  device_id uuid not null references public.devices(id) on delete restrict,
  type text not null check (type in ('temp_high', 'temp_low', 'door_open', 'connection_lost')),
  status text not null default 'open' check (status in ('open', 'acknowledged', 'resolved')),
  opened_at timestamptz not null,
  recovered_at timestamptz,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles(id) on delete restrict,
  resolved_at timestamptz,
  resolved_by uuid references public.profiles(id) on delete restrict,
  resolution_note text,
  constraint alerts_acknowledged_fields check (
    status <> 'acknowledged' or (acknowledged_at is not null and acknowledged_by is not null)
  ),
  constraint alerts_resolved_fields check (
    status <> 'resolved' or (resolved_at is not null and resolved_by is not null
      and resolution_note is not null and resolution_note ~ '[^[:space:]]')
  )
);

create unique index alerts_one_unresolved_per_trip_type_idx on public.alerts (trip_id, type)
  where status <> 'resolved';
create index alerts_trip_status_idx on public.alerts (trip_id, status);
create index alerts_device_opened_at_idx on public.alerts (device_id, opened_at);

create table public.alert_events (
  id bigint generated always as identity primary key,
  alert_id uuid not null references public.alerts(id) on delete restrict,
  event_type text not null check (event_type in ('opened', 'recovered', 'acknowledged', 'resolved', 'reopened', 'recurred')),
  actor_id uuid references public.profiles(id) on delete restrict,
  created_at timestamptz not null,
  payload jsonb not null default '{}'::jsonb
);

create index alert_events_alert_created_at_idx on public.alert_events (alert_id, created_at);

create table public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles(id) on delete restrict,
  type text not null,
  title text not null,
  body text not null,
  payload jsonb not null default '{}'::jsonb,
  read_at timestamptz,
  created_at timestamptz not null default now(),
  constraint notifications_payload_no_sensitive_keys check (not (payload ?| array['lat', 'lng', 'gps', 'phone']))
);

comment on constraint notifications_payload_no_sensitive_keys on public.notifications is
  'Checks top-level keys only. The API must validate the full payload and notification text.';

create index notifications_user_read_created_at_idx on public.notifications (user_id, read_at, created_at);

create table public.audit_logs (
  id bigint generated always as identity primary key,
  actor_id uuid references public.profiles(id) on delete restrict,
  action text not null,
  entity text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null
);

create function private.reject_audit_log_mutation() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'audit_logs is append-only' using errcode = '42501';
end;
$$;

revoke all on function private.reject_audit_log_mutation() from public, anon, authenticated, service_role;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each statement execute function private.reject_audit_log_mutation();

create table public.idempotency_requests (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles(id) on delete restrict,
  idempotency_key text not null,
  operation text not null,
  payload_hash text not null,
  response jsonb,
  status_code integer,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint idempotency_requests_user_key unique (user_id, idempotency_key),
  constraint idempotency_requests_expiry check (expires_at > created_at)
);

create table public.outbox_events (
  id bigint generated always as identity primary key,
  topic text not null,
  payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'published', 'failed')),
  attempts integer not null default 0 check (attempts >= 0),
  available_at timestamptz not null default now(),
  last_error text,
  created_at timestamptz not null default now(),
  published_at timestamptz,
  constraint outbox_events_published_time check (status <> 'published' or published_at is not null)
);

create index outbox_events_pending_available_at_idx on public.outbox_events (available_at)
  where status = 'pending';

alter table public.alerts enable row level security;
alter table public.alert_events enable row level security;
alter table public.notifications enable row level security;
alter table public.audit_logs enable row level security;
alter table public.idempotency_requests enable row level security;
alter table public.outbox_events enable row level security;

revoke all on public.alerts, public.alert_events, public.notifications, public.audit_logs,
  public.idempotency_requests, public.outbox_events from public, anon, authenticated, service_role;
revoke all on sequence public.alert_events_id_seq, public.audit_logs_id_seq,
  public.idempotency_requests_id_seq, public.outbox_events_id_seq from public, anon, authenticated, service_role;

grant select on public.alerts, public.alert_events, public.notifications to authenticated;
grant select, insert, update, delete on public.alerts, public.alert_events, public.notifications,
  public.idempotency_requests, public.outbox_events to service_role;
grant select, insert on public.audit_logs to service_role;
grant usage on sequence public.alert_events_id_seq, public.audit_logs_id_seq,
  public.idempotency_requests_id_seq, public.outbox_events_id_seq to service_role;

-- The existing trip policy hides trip rows from customers. Check ownership for
-- this policy without returning trip or shipment data or granting schema usage.
create function private.customer_owns_alert_trip(target_trip_id uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select (select public.current_account_role()) = 'customer' and exists (
    select 1
    from public.trips t
    join public.shipments s on s.id = t.shipment_id
    where t.id = target_trip_id and s.customer_id = (select auth.uid())
  );
$$;

revoke all on function private.customer_owns_alert_trip(uuid) from public, anon, authenticated, service_role;
grant execute on function private.customer_owns_alert_trip(uuid) to authenticated;

create policy alerts_scoped_read on public.alerts for select to authenticated
  using ((select public.has_permission('alerts.read')) and (
    (select public.current_account_role()) = 'admin'
    or ((select public.current_account_role()) = 'driver' and exists (
      select 1 from public.trips t where t.id = alerts.trip_id and t.driver_id = (select auth.uid())
    ))
    or private.customer_owns_alert_trip(trip_id)
  ));

create policy alert_events_scoped_read on public.alert_events for select to authenticated
  using (exists (select 1 from public.alerts a where a.id = alert_events.alert_id));

create policy notifications_recipient_read on public.notifications for select to authenticated
  using (user_id = (select auth.uid()) and (select public.current_account_role()) is not null);

commit;
