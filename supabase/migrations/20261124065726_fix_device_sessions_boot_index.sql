begin;

alter table public.device_sessions
  drop constraint device_sessions_device_id_boot_id_key;

-- One boot may cover several segments, including several trips.
create index device_sessions_device_id_boot_id_idx
  on public.device_sessions (device_id, boot_id);

create unique index device_sessions_one_open_per_device_idx
  on public.device_sessions (device_id)
  where ended_at is null;

commit;
