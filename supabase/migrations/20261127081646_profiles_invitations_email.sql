begin;

alter table public.profiles add column version integer not null default 1
  constraint profiles_version_positive check (version >= 1);
create unique index profiles_email_lower_unique on public.profiles (lower(email)) where email is not null;

create table public.account_invitations (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null constraint account_invitations_token_hash_unique unique,
  email text not null,
  role_id uuid not null references public.roles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  used_at timestamptz,
  used_by uuid references public.profiles(id) on delete restrict,
  revoked_at timestamptz,
  constraint account_invitations_exact_expiry check (expires_at = created_at + interval '72 hours'),
  constraint account_invitations_used_pair check ((used_at is null) = (used_by is null))
);
alter table public.account_invitations enable row level security;
revoke all on public.account_invitations from public, anon, authenticated, service_role;
grant select, insert, update, delete on public.account_invitations to service_role;

-- account.manage is also absent from baseline; both capabilities are admin-only.
insert into public.permissions(code) values ('account.invite'), ('account.manage') on conflict (code) do nothing;
insert into public.role_permissions(role_id, permission_id)
select r.id, p.id from public.roles r cross join public.permissions p
where r.code = 'admin' and p.code in ('account.invite', 'account.manage')
on conflict do nothing;

commit;
