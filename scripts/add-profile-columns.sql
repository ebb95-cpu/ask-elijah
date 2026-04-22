-- Run this once in the Supabase SQL editor to support the onboarding flow's
-- profile capture. The /api/sign-up + /api/profile routes already write to
-- these columns; until the migration runs, writes to the missing ones are
-- silently dropped (the upsert fails and the rest of the row still saves).
--
-- Fields used:
--   age         — onboarding step 1 (13 / 14 / 15 / 16 / 17 / 18+)
--   weaknesses  — reserved for a future onboarding expansion
--   strengths   — reserved for a future onboarding expansion
--
-- `position`, `challenge`, `first_name` columns are assumed to already
-- exist (they've been in the profiles table since day one and the select
-- queries in /api/profile read them directly).
--
-- Supabase dashboard: Database → SQL Editor → paste + run.

alter table profiles
  add column if not exists age text,
  add column if not exists weaknesses text,
  add column if not exists strengths text;
