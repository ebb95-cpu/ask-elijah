-- Controlled launch invite clock.
-- The invite expires only if the player has not asked any question by the
-- deadline. We do not delete accounts; we expire the access slot.

alter table waitlist
  add column if not exists invite_sent_at timestamptz,
  add column if not exists access_expires_at timestamptz;

create index if not exists waitlist_access_expires_idx
  on waitlist (access_expires_at)
  where approved = true and access_expires_at is not null;
