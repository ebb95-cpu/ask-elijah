-- Error log: central place for silent failures (Beehiiv, Resend, Pinecone, backups, etc.)
create table if not exists error_log (
  id uuid primary key default gen_random_uuid(),
  source text not null,                  -- e.g. 'ask:beehiiv', 'approve:backup', 'ask:resend'
  message text not null,
  context jsonb,                         -- arbitrary extra detail (question_id, email, etc.)
  created_at timestamptz not null default now()
);
create index if not exists error_log_created_at_idx on error_log (created_at desc);
create index if not exists error_log_source_idx on error_log (source);

-- player_memories: referenced in code but never migrated
create table if not exists player_memories (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  fact_type text not null,               -- event | context | goal | setback
  fact_text text not null,
  source_question_id uuid,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists player_memories_email_idx on player_memories (email);
create index if not exists player_memories_expires_idx on player_memories (expires_at);

-- Missing profile columns referenced in code
alter table profiles add column if not exists first_name text;
alter table profiles add column if not exists age_range text;
alter table profiles add column if not exists challenge text;
alter table profiles add column if not exists country text;

-- Soft-delete + audit on questions
alter table questions add column if not exists deleted_at timestamptz;
alter table questions add column if not exists approved_at timestamptz;
alter table questions add column if not exists ai_draft text;              -- what the AI generated pre-edit
alter table questions add column if not exists corrections jsonb;          -- VERIFY flag responses: [{flag, elijah_correction}]
alter table questions add column if not exists edit_count int not null default 0;
alter table questions add column if not exists topic_confidence real;      -- null means we couldn't classify
alter table questions add column if not exists updated_at timestamptz not null default now();

create index if not exists questions_deleted_at_idx on questions (deleted_at) where deleted_at is null;
create index if not exists questions_status_idx on questions (status);

-- Keep updated_at fresh
create or replace function set_updated_at() returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists questions_updated_at on questions;
create trigger questions_updated_at
  before update on questions
  for each row execute function set_updated_at();
