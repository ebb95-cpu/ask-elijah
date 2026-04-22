-- Run this once in the Supabase SQL editor to support the onboarding flow's
-- weaknesses + strengths capture. The /api/sign-up + /api/profile routes
-- already write to these columns; until the migration runs, writes are
-- silently dropped (the upsert fails and the rest of the row still saves).
--
-- Supabase dashboard: Database → SQL Editor → paste + run.

alter table profiles
  add column if not exists weaknesses text,
  add column if not exists strengths text;
