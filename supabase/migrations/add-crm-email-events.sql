-- Lightweight CRM email history for the admin dashboard.
-- Beehiiv remains the marketing engine. Resend remains transactional.
-- This table stores the admin-facing audit trail so Elijah can see what was
-- sent or triggered for each player/parent without rebuilding Beehiiv.

create table if not exists crm_email_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  provider text not null check (provider in ('beehiiv', 'resend')),
  action text not null,
  status text not null default 'sent' check (status in ('sent', 'failed')),
  subject text,
  tags text[] not null default '{}',
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

alter table crm_email_events enable row level security;

create index if not exists crm_email_events_email_created_idx
  on crm_email_events (email, created_at desc);

create index if not exists crm_email_events_provider_created_idx
  on crm_email_events (provider, created_at desc);
