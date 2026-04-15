-- Entry mode on each question: the path the user came in through.
-- Drives tone, clarifying questions, and which RAG context we prioritize.
-- Values: 'bad_game' | 'coach' | 'playing_time' | 'parent' | 'general' | null
alter table questions add column if not exists mode text;
alter table questions add column if not exists asker_type text; -- 'player' | 'parent' | null

-- 7-day follow-up tracking: stamped when the "did it help?" email is sent
alter table questions add column if not exists followup_sent_at timestamptz;
create index if not exists questions_followup_idx on questions (approved_at)
  where followup_sent_at is null and status = 'approved';

-- Level on profile if not already present; snapshot it on each question too
-- so we can segment analytics even if a player changes level mid-career.
alter table profiles add column if not exists level text;
alter table questions add column if not exists level_snapshot text;
