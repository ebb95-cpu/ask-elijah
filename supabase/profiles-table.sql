-- Run this in your Supabase SQL editor after questions-table.sql

create table if not exists profiles (
  id           uuid default gen_random_uuid() primary key,
  email        text unique not null,
  name         text,
  age          int,
  position     text,        -- PG, SG, SF, PF, C, None
  level        text,        -- high_school, college, pro, recreational
  struggle     text,        -- main pain point
  goals        text[],      -- preset goal selections
  custom_goal  text,        -- free-text "anything else"
  language     text default 'en',
  created_at   timestamptz default now(),
  updated_at   timestamptz default now()
);

create index if not exists profiles_email_idx on profiles (email);
