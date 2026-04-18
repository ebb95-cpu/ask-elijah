-- Feedback + bug-report tables.
--
-- answer_feedback: a single thumb per user per question. Upsert on
-- (question_id, email) so re-tapping swaps the vote rather than stacking.
-- Comment is optional and only captured on thumbs-down (the signal that
-- matters for product iteration).
--
-- bug_reports: one row per user-submitted bug via the floating "Something
-- broken?" button. Captures page URL + user agent + free-text message so
-- Elijah can reproduce without a back-and-forth. resolved_at tracks
-- triage state.

create table if not exists answer_feedback (
  id           uuid primary key default gen_random_uuid(),
  question_id  uuid not null references questions(id) on delete cascade,
  email        text,
  rating       text not null check (rating in ('up', 'down')),
  comment      text,
  user_agent   text,
  created_at   timestamptz not null default now(),
  unique (question_id, email)
);

create index if not exists answer_feedback_question_idx on answer_feedback (question_id);
create index if not exists answer_feedback_rating_idx on answer_feedback (rating, created_at desc);

create table if not exists bug_reports (
  id           uuid primary key default gen_random_uuid(),
  email        text,
  page_url     text,
  user_agent   text,
  message      text not null,
  resolved_at  timestamptz,
  created_at   timestamptz not null default now()
);

create index if not exists bug_reports_created_idx on bug_reports (created_at desc);
create index if not exists bug_reports_unresolved_idx on bug_reports (created_at desc) where resolved_at is null;
