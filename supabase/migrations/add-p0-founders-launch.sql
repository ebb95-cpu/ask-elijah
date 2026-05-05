-- P0 Founders launch fields and lightweight notification infrastructure.

alter table waitlist
  add column if not exists application_status text not null default 'pending'
    check (application_status in ('pending', 'accepted', 'declined', 'waitlisted')),
  add column if not exists accepted_at timestamptz,
  add column if not exists age text,
  add column if not exists level text,
  add column if not exists position text;

create index if not exists waitlist_application_status_idx
  on waitlist (application_status, created_at desc);

create index if not exists waitlist_accepted_idx
  on waitlist (approved, accepted_at desc)
  where approved = true;

create table if not exists founder_video_slots (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  waitlist_id uuid,
  status text not null default 'pending'
    check (status in ('pending', 'recorded', 'sent', 'skipped')),
  created_at timestamptz not null default now(),
  recorded_at timestamptz,
  sent_at timestamptz,
  video_url text,
  note text
);

alter table founder_video_slots enable row level security;

create index if not exists founder_video_slots_email_created_idx
  on founder_video_slots (email, created_at desc);

create unique index if not exists founder_video_slots_waitlist_id_key
  on founder_video_slots (waitlist_id);

alter table questions
  add column if not exists rep_text text,
  add column if not exists rep_status text not null default 'not_yet'
    check (rep_status in ('not_yet', 'yes', 'no')),
  add column if not exists rep_reflection text,
  add column if not exists rep_reflected_at timestamptz,
  add column if not exists training_eligible boolean not null default true,
  add column if not exists do_not_train boolean not null default false;

create index if not exists questions_rep_followup_idx
  on questions (approved_at, followup_sent_at)
  where status = 'approved' and followup_sent_at is null;

alter table reflections
  add column if not exists outcome text check (outcome in ('yes', 'no')),
  add column if not exists source text not null default 'archive';

create table if not exists push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  endpoint text not null unique,
  p256dh text not null,
  auth text not null,
  user_agent text,
  enabled boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table push_subscriptions enable row level security;

create index if not exists push_subscriptions_email_enabled_idx
  on push_subscriptions (email, enabled);

create table if not exists notification_events (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  channel text not null check (channel in ('email', 'push')),
  action text not null,
  status text not null check (status in ('sent', 'failed', 'skipped')),
  question_id uuid,
  metadata jsonb not null default '{}'::jsonb,
  error text,
  created_at timestamptz not null default now()
);

alter table notification_events enable row level security;

create index if not exists notification_events_email_created_idx
  on notification_events (email, created_at desc);
