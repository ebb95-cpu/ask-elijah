-- Learning loop primitives.
--
-- elijah_preferences stores reusable coaching/style preferences extracted
-- from admin remix notes. These get injected into future generation prompts.
--
-- Gold answers are approved answers Elijah wants the AI to treat as canonical
-- for future similar questions.

create table if not exists elijah_preferences (
  id uuid primary key default gen_random_uuid(),
  preference text not null,
  category text not null default 'general',
  source_question_id uuid references questions(id) on delete set null,
  source_note text,
  confidence numeric default 0.8,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  last_used_at timestamptz
);

create index if not exists elijah_preferences_active_idx
  on elijah_preferences (active, created_at desc);

alter table questions add column if not exists is_gold_answer boolean not null default false;
alter table questions add column if not exists gold_reason text;
alter table questions add column if not exists answer_quality jsonb;
alter table questions add column if not exists answer_quality_overall int;
alter table questions add column if not exists answer_quality_top_weakness text;

create index if not exists questions_gold_answers_idx
  on questions (is_gold_answer, approved_at desc)
  where is_gold_answer = true;
