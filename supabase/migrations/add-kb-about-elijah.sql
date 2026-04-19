-- Classify each KB source as "about Elijah" (interviews, profiles, his own
-- content) vs "basketball research" (third-party tactical/mindset content).
-- Default false so existing rows show up as "research" until toggled.
ALTER TABLE kb_sources
  ADD COLUMN IF NOT EXISTS is_about_elijah BOOLEAN NOT NULL DEFAULT FALSE;

CREATE INDEX IF NOT EXISTS kb_sources_about_elijah_idx
  ON kb_sources (is_about_elijah);
