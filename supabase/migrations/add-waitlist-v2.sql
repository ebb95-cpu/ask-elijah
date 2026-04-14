ALTER TABLE waitlist
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS challenge text,
  ADD COLUMN IF NOT EXISTS confirmed boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS approved boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS confirm_token uuid DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS waitlist_confirm_token_idx ON waitlist(confirm_token);
CREATE INDEX IF NOT EXISTS waitlist_approved_idx ON waitlist(approved, confirmed, created_at DESC);
