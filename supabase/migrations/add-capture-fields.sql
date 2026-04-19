-- Post-first-answer profile capture (Hooked Investment phase).
-- Stage 1 (level, position, challenge) uses existing columns.
-- Stage 2 adds two new fields the user commits to after their 2nd/3rd answer.
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS timeline TEXT,
  ADD COLUMN IF NOT EXISTS system TEXT;
