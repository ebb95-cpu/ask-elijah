-- Tracks which answers were personally reviewed and approved by Elijah, as
-- opposed to answers that went out through an auto-approve path (future:
-- high-confidence KB matches). Shown to students in /browse as a trust
-- badge ("Reviewed by Elijah") and in the admin queue so Elijah can see
-- at a glance which pending cards he's already worked on.
--
-- Backfill: every currently-approved answer was manually reviewed by the
-- admin pipeline historically, so set them all to true retroactively.

alter table questions
  add column if not exists reviewed_by_elijah boolean not null default false;

update questions
  set reviewed_by_elijah = true
  where status = 'approved'
    and reviewed_by_elijah = false;

create index if not exists questions_reviewed_idx
  on questions (reviewed_by_elijah)
  where reviewed_by_elijah = true;
