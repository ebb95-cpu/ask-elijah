-- Founder beta billing and retention state.

alter table waitlist add column if not exists beta_ends_at timestamptz;
alter table waitlist add column if not exists billing_reminder_sent_at timestamptz;
alter table waitlist add column if not exists payment_method_collected_at timestamptz;

alter table profiles add column if not exists beta_started_at timestamptz;
alter table profiles add column if not exists beta_ends_at timestamptz;
alter table profiles add column if not exists first_charge_at timestamptz;
alter table profiles add column if not exists guarantee_ends_at timestamptz;
alter table profiles add column if not exists payment_failed_at timestamptz;
alter table profiles add column if not exists payment_grace_ends_at timestamptz;
alter table profiles add column if not exists cancelled_at timestamptz;
alter table profiles add column if not exists last_refund_at timestamptz;

create index if not exists waitlist_beta_ends_at_idx on waitlist (beta_ends_at);
create index if not exists waitlist_billing_reminder_idx on waitlist (billing_reminder_sent_at, beta_ends_at);
create index if not exists profiles_beta_ends_at_idx on profiles (beta_ends_at);
create index if not exists profiles_payment_grace_idx on profiles (payment_grace_ends_at);
