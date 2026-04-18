-- Pain-point research pipeline. Nightly cron scrapes YouTube comments,
-- Reddit threads, and Google autocomplete for Elijah's demographic
-- (youth + amateur basketball players), synthesizes via Claude into
-- clustered pain points, and stores the run so the admin dashboard
-- can show trends over time.
--
-- Storing the raw sources and the synthesized output together as JSONB
-- keeps the schema flexible while the pipeline stabilises; we can
-- normalise into separate tables later if we need to query insights
-- directly.

create table if not exists pain_research_runs (
  id            uuid primary key default gen_random_uuid(),
  started_at    timestamptz not null default now(),
  finished_at   timestamptz,
  status        text not null default 'running', -- 'running' | 'completed' | 'failed'
  error         text,

  -- raw collected items before synthesis. Array of
  --   { source, source_url, text, author, created_at, metadata }
  raw_count     int not null default 0,
  raw_samples   jsonb not null default '[]',

  -- synthesized output from Claude. Shape:
  --   { pain_points: [{ title, summary, quotes: [{text, source_url}], score }],
  --     top_questions: [{ question, score }],
  --     demographic: string,
  --     source_breakdown: { youtube: n, reddit: n, autocomplete: n } }
  synthesis     jsonb,

  -- quick stats surfaced in the admin index view without parsing synthesis
  pain_count    int,
  question_count int
);

create index if not exists pain_research_runs_started_idx
  on pain_research_runs (started_at desc);
