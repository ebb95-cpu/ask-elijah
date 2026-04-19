-- Track when the original content was published (YouTube upload date,
-- Beehiiv publish_date, etc.) so the admin KB page can sort by actual
-- publish order instead of KB ingest order.
--
-- Nullable because we don't always know the real publish date for older
-- uploaded content. Sort falls back to created_at when null.
ALTER TABLE kb_sources
  ADD COLUMN IF NOT EXISTS published_at TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS kb_sources_published_at_idx
  ON kb_sources (published_at DESC NULLS LAST);
