-- Launch pricing hooks and parent acquisition tables.
-- Subscription enforcement stays conservative so existing beta access does not
-- break while Stripe price IDs are being wired in production.

alter table profiles add column if not exists subscription_tier text default 'free';
alter table profiles add column if not exists monthly_question_limit int default 5;
alter table profiles add column if not exists priority_credits int not null default 0;
alter table profiles add column if not exists gifted_by_parent_email text;

create table if not exists parent_leads (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  magnet text not null default '1-for-9',
  source text not null default 'parents',
  created_at timestamptz not null default now(),
  unique (email, magnet)
);

create index if not exists parent_leads_created_idx on parent_leads (created_at desc);
create index if not exists parent_leads_email_idx on parent_leads (email);
