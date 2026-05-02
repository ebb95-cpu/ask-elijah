-- Soft-remove access list rows without losing player history.
-- Archived rows are hidden from active admin tabs, do not count toward the
-- Founding 200, and no longer pass the access gate. Their questions,
-- profile, application text, and admin notes stay available if they return.

alter table waitlist
  add column if not exists archived_at timestamptz;

create index if not exists waitlist_archived_at_idx
  on waitlist (archived_at, created_at desc);

create index if not exists waitlist_active_approved_idx
  on waitlist (approved, created_at desc)
  where archived_at is null;
