-- Chat threads: add solved state and conversation history to questions table
alter table questions add column if not exists solved boolean not null default false;
alter table questions add column if not exists solved_at timestamptz;
alter table questions add column if not exists conversation jsonb default '[]'::jsonb;

-- Index for fetching unsolved/solved threads per user
create index if not exists questions_email_solved_idx
  on questions (email, solved, created_at desc)
  where deleted_at is null;
