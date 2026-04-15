-- Scorecard: the rubric grade Claude gave the draft at approval time.
-- Storing this (plus overall score + topWeakness) lets us later correlate
-- "what Claude predicted" with "how players actually responded" (upvotes,
-- shares, follow-ups), so we can calibrate the scoring model over time.
alter table questions add column if not exists scorecard jsonb;
alter table questions add column if not exists scorecard_overall int;
