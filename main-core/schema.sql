-- USHA ONE Main Core V1 — Supabase/Postgres starter schema

create extension if not exists pgcrypto;

create table if not exists workspaces (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text unique not null,
  status text not null default 'active',
  created_at timestamptz not null default now()
);

create table if not exists contacts (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  full_name text,
  phone text,
  email text,
  source text,
  tags text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_contacts_workspace_phone on contacts(workspace_id, phone);
create index if not exists idx_contacts_workspace_email on contacts(workspace_id, email);

create table if not exists leads (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  title text,
  stage text not null default 'new',
  temperature text not null default 'warm',
  owner text,
  next_follow_up_at timestamptz,
  status text not null default 'open',
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists conversations (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  contact_id uuid references contacts(id) on delete set null,
  lead_id uuid references leads(id) on delete set null,
  channel text not null,
  external_thread_id text,
  status text not null default 'open',
  assigned_to text,
  last_message_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists idx_conversation_external on conversations(workspace_id, channel, external_thread_id) where external_thread_id is not null;

create table if not exists messages (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid not null references conversations(id) on delete cascade,
  direction text not null check (direction in ('inbound','outbound')),
  sender_type text not null default 'customer',
  body text,
  message_type text not null default 'text',
  external_message_id text,
  delivery_status text,
  ai_generated boolean not null default false,
  created_at timestamptz not null default now()
);

create table if not exists tasks (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  lead_id uuid references leads(id) on delete cascade,
  contact_id uuid references contacts(id) on delete cascade,
  title text not null,
  due_at timestamptz,
  status text not null default 'open',
  priority text not null default 'normal',
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create table if not exists agent_runs (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  conversation_id uuid references conversations(id) on delete set null,
  intent text,
  model_provider text,
  model_name text,
  prompt_tokens integer,
  completion_tokens integer,
  estimated_cost numeric(12,6),
  decision jsonb not null default '{}'::jsonb,
  approval_required boolean not null default true,
  approval_status text not null default 'pending',
  created_at timestamptz not null default now()
);

create table if not exists action_log (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references workspaces(id) on delete cascade,
  actor_type text not null,
  actor_id text,
  action_type text not null,
  entity_type text,
  entity_id uuid,
  payload jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- Seed first pilot workspace manually after deployment:
-- insert into workspaces(name, slug) values ('Neo School India','neo-school-india');
