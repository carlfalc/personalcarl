create table public.pending_family_profiles (
  id uuid primary key default gen_random_uuid(),
  chat_id bigint not null,
  memory_id uuid not null,
  status text not null default 'awaiting_details',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

grant all on public.pending_family_profiles to service_role;

alter table public.pending_family_profiles enable row level security;

create index idx_pending_family_profiles_chat_status on public.pending_family_profiles (chat_id, status, created_at desc);