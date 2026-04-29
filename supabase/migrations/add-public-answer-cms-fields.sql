-- Public answer CMS metadata.
--
-- Additive only. Existing private locker-room questions keep working.
-- public=true gates /browse and /parents. parent_relevant=true lets the
-- parent page surface only answers that help parents understand the mental
-- side without exposing any student's private locker room.

alter table questions add column if not exists asker_label text;
alter table questions add column if not exists player_age int;
alter table questions add column if not exists themes text[] not null default '{}';
alter table questions add column if not exists parent_relevant boolean not null default false;
alter table questions add column if not exists public boolean not null default false;
alter table questions add column if not exists age_band text;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'questions_age_band_check'
  ) then
    alter table questions
      add constraint questions_age_band_check
      check (age_band is null or age_band in ('12-14', '15-17', '18-22', '22+'));
  end if;
end $$;

create index if not exists questions_public_approved_idx
  on questions (public, status, created_at desc)
  where deleted_at is null;

create index if not exists questions_parent_public_idx
  on questions (parent_relevant, public, created_at desc)
  where deleted_at is null;

create index if not exists questions_themes_gin_idx
  on questions using gin (themes);
