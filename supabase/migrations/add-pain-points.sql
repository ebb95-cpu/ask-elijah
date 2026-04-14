CREATE TABLE IF NOT EXISTS pain_points (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  source text NOT NULL,                     -- 'reddit'
  source_url text,                          -- link to original post
  source_context text,                      -- subreddit name
  original_text text NOT NULL,              -- raw scraped text
  cleaned_question text NOT NULL,           -- Claude's cleaned version
  status text NOT NULL DEFAULT 'pending',   -- 'pending' | 'answered' | 'skipped' | 'auto_answered'
  draft_answer text,                        -- AI co-pilot draft
  kb_sources jsonb DEFAULT '[]',            -- [{title, url, type, text}] from Pinecone
  final_answer text,
  pinecone_ingested boolean DEFAULT false,
  created_at timestamptz DEFAULT now(),
  answered_at timestamptz
);
CREATE INDEX IF NOT EXISTS pain_points_status_idx ON pain_points(status, created_at DESC);
