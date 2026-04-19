-- Drop the is_about_elijah classification (everything in the KB is Elijah's
-- content; the toggle added noise without utility) and replace with a
-- cached thumbnail_url column for non-YouTube sources (newsletters, etc.)
-- populated via /api/admin/kb-sources/fetch-thumbnail.
ALTER TABLE kb_sources DROP COLUMN IF EXISTS is_about_elijah;
DROP INDEX IF EXISTS kb_sources_about_elijah_idx;

ALTER TABLE kb_sources ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
