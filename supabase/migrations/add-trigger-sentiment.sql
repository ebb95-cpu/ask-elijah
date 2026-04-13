-- Questions table: emotional trigger + helpful count from reflections
ALTER TABLE questions
  ADD COLUMN IF NOT EXISTS trigger text,
  ADD COLUMN IF NOT EXISTS helpful_count int4 DEFAULT 0;

-- Reflections table: sentiment from AI classification
ALTER TABLE reflections
  ADD COLUMN IF NOT EXISTS sentiment text;

-- Indexes
CREATE INDEX IF NOT EXISTS idx_questions_trigger ON questions(trigger);
CREATE INDEX IF NOT EXISTS idx_questions_helpful_count ON questions(helpful_count DESC);
CREATE INDEX IF NOT EXISTS idx_reflections_sentiment ON reflections(sentiment);
