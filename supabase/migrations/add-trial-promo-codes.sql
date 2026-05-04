-- Admin-generated free trial promo codes.

create table if not exists trial_promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  label text not null default 'Tester trial',
  trial_days int not null default 30 check (trial_days between 1 and 90),
  max_redemptions int check (max_redemptions is null or max_redemptions > 0),
  redeemed_count int not null default 0,
  active boolean not null default true,
  expires_at timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists trial_promo_redemptions (
  id uuid primary key default gen_random_uuid(),
  code text not null references trial_promo_codes(code) on delete cascade,
  email text not null,
  stripe_customer_id text,
  stripe_subscription_id text,
  redeemed_at timestamptz not null default now(),
  unique (code, email)
);

create index if not exists trial_promo_codes_active_created_idx
  on trial_promo_codes (active, created_at desc);

create index if not exists trial_promo_redemptions_email_idx
  on trial_promo_redemptions (email, redeemed_at desc);
