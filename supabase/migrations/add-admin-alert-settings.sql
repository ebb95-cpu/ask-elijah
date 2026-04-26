-- Admin alert preferences for the "Elijah Brain" backend dashboard.

create table if not exists admin_alert_settings (
  key text primary key,
  enabled boolean not null default true,
  threshold int,
  description text,
  updated_at timestamptz not null default now()
);

insert into admin_alert_settings (key, enabled, threshold, description)
values
  ('repeat_question', true, 5, 'Notify when multiple players are asking the same thing.'),
  ('bad_feedback', true, 1, 'Notify when an answer gets negative written feedback.'),
  ('weak_topic', true, 3, 'Notify when a topic has repeated questions but weak knowledge coverage.'),
  ('watchdog_failure', true, 1, 'Notify when the watchdog or Sentry sees a technical problem.')
on conflict (key) do nothing;
