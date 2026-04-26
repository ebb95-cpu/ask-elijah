-- Version history for approved answers.
--
-- The questions.answer column remains the current live answer. Every time an
-- admin revises an already-approved answer, the previous answer is copied here
-- before the live row is updated. This keeps Elijah's changing opinions
-- auditable without showing stale advice to players.

create table if not exists answer_versions (
  id uuid primary key default gen_random_uuid(),
  question_id uuid not null references questions(id) on delete cascade,
  version_number int not null,
  answer text not null,
  sources jsonb not null default '[]'::jsonb,
  change_note text,
  opinion_changed boolean not null default false,
  created_by text not null default 'admin',
  created_at timestamptz not null default now()
);

create unique index if not exists answer_versions_question_version_idx
  on answer_versions (question_id, version_number);

create index if not exists answer_versions_question_created_idx
  on answer_versions (question_id, created_at desc);
