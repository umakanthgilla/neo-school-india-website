-- ONE Communication Hub V1 — Neo School India pilot
-- Run in the dedicated Main Core Supabase/Postgres project, not production Neo DB without review.
create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  name text,
  phone text,
  email text,
  source text,
  created_at timestamptz not null default now(),
  unique(workspace_id, phone)
);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  type text not null default 'general',
  stage text not null default 'new',
  interest text,
  priority text not null default 'warm',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid not null references contacts(id) on delete cascade,
  channel text not null,
  external_thread_id text,
  status text not null default 'open',
  updated_at timestamptz not null default now(),
  unique(workspace_id, channel, contact_id)
);

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  provider text,
  external_message_id text,
  direction text not null check(direction in ('inbound','outbound')),
  type text not null default 'text',
  body text,
  status text,
  provider_timestamp text,
  created_at timestamptz not null default now(),
  unique(provider, external_message_id)
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  title text not null,
  note text,
  due_at timestamptz,
  status text not null default 'open',
  created_at timestamptz not null default now()
);

create table if not exists action_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  action_type text not null default 'outbound_reply',
  payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending_approval',
  approved_by uuid,
  approved_at timestamptz,
  executed_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_conversations_workspace_updated on conversations(workspace_id, updated_at desc);
create index if not exists idx_messages_conversation_created on messages(conversation_id, created_at);
create index if not exists idx_tasks_workspace_due on tasks(workspace_id, due_at);

alter table workspaces enable row level security;
alter table contacts enable row level security;
alter table leads enable row level security;
alter table conversations enable row level security;
alter table messages enable row level security;
alter table tasks enable row level security;
alter table action_log enable row level security;

-- No permissive anonymous RLS policies are created here intentionally.
-- Add authenticated workspace-member policies after auth/membership tables are configured.

insert into workspaces(name,slug)
values ('Neo School India','neo-school-india')
on conflict (slug) do nothing;
