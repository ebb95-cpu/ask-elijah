-- Registry of knowledge-base sources that have been ingested into Pinecone.
-- This is the inventory — one row per upload/ingestion, so we can show
-- Elijah what's already in the KB and let him remove sources if needed.
-- (Pinecone metadata can be scanned but there's no cheap "list distinct
-- source_titles" API; a Supabase table is the right place for inventory.)
create table if not exists kb_sources (
  id uuid primary key default gen_random_uuid(),
  source_title text not null,
  source_type text not null,           -- upload_text, upload_pdf, upload_url, upload_youtube, upload_audio, newsletter, youtube, drive_pdf
  source_url text,
  topic text,
  level text,
  chunk_count int not null default 0,
  id_prefix text,                      -- the Pinecone id-prefix used, for delete-by-prefix later
  created_at timestamptz not null default now()
);
create index if not exists kb_sources_created_idx on kb_sources (created_at desc);
create index if not exists kb_sources_type_idx on kb_sources (source_type);
