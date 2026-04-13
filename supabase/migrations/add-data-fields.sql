-- Questions table: UTM tracking + topic tagging + language
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS utm_source text,
  ADD COLUMN IF NOT EXISTS utm_medium text,
  ADD COLUMN IF NOT EXISTS utm_campaign text,
  ADD COLUMN IF NOT EXISTS topic text,
  ADD COLUMN IF NOT EXISTS language_detected text;

-- Profiles table: age range + team/school
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS age_range text,
  ADD COLUMN IF NOT EXISTS team_school text;

-- Index topic for analytics queries
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_utm_source ON questions(utm_source);
CREATE INDEX IF NOT EXISTS idx_profiles_age_range ON profiles(age_range);
CREATE INDEX IF NOT EXISTS idx_profiles_level ON profiles(level);
