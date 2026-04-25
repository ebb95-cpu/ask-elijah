-- Admin-only player notes for controlled launch triage.
-- Stores Elijah/internal judgment that should never be shown to players.

create table if not exists player_admin_notes (
  email text primary key,
  note text,
  high_value boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists player_admin_notes_high_value_idx
  on player_admin_notes (high_value, updated_at desc);
