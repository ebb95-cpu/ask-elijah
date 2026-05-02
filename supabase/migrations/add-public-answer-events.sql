-- Captures public browse answer intent without forcing a signup first.
-- Example: a logged-out player taps "Me too" on a specific public answer.
-- This keeps the exact pain signal tied to the answer they reacted to.

create table if not exists public_answer_events (
  id uuid primary key default gen_random_uuid(),
  event_type text not null,
  question_id uuid references questions(id) on delete set null,
  question_text text,
  themes text[] default '{}',
  email text,
  anonymous_id text,
  metadata jsonb default '{}'::jsonb,
  user_agent text,
  created_at timestamptz not null default now()
);

alter table public_answer_events enable row level security;

create index if not exists public_answer_events_question_idx
  on public_answer_events (question_id, created_at desc);

create index if not exists public_answer_events_email_idx
  on public_answer_events (email, created_at desc)
  where email is not null;

create index if not exists public_answer_events_anonymous_idx
  on public_answer_events (anonymous_id, created_at desc)
  where anonymous_id is not null;
