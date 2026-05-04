-- Track tester promo trials from Stripe Checkout.

alter table profiles add column if not exists trial_started_at timestamptz;
alter table profiles add column if not exists trial_ends_at timestamptz;
alter table profiles add column if not exists trial_source text;
alter table profiles add column if not exists trial_promo_code text;

create index if not exists profiles_trial_ends_at_idx on profiles (trial_ends_at);
create index if not exists profiles_trial_promo_code_idx on profiles (trial_promo_code);
