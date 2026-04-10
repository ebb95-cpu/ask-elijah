-- Run this in your Supabase SQL editor
-- supabase.com → your project → SQL Editor → New Query

create table if not exists questions (
  id          uuid default gen_random_uuid() primary key,
  email       text,
  question    text not null,
  answer      text not null,
  sources     jsonb default '[]',   -- [{title, url, type}] from RAG
  ip          text,
  recap_sent  boolean default false,
  created_at  timestamptz default now()
);

-- Index for the daily cron job (find all unsent recaps from yesterday)
create index if not exists questions_recap_idx on questions (recap_sent, created_at);

-- Index for per-email question counts (rate limiting)
create index if not exists questions_email_idx on questions (email, created_at);

-- Index for per-IP question counts (anonymous rate limiting)
create index if not exists questions_ip_idx on questions (ip, created_at);
