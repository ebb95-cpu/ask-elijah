alter table waitlist
  add column if not exists city text,
  add column if not exists founders_wall_opt_in boolean default false;

create index if not exists waitlist_founders_wall_idx
  on waitlist (approved, founders_wall_opt_in);
