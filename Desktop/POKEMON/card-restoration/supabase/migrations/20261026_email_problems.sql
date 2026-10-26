-- Emails that didn't reach the customer: bounced, marked as spam, suppressed by
-- Resend (it stops sending to an address that bounced before) or failed.
-- Shared database: the same file is in both repos (card-restoration and New-Website-Concept).
--
-- Written only by Resend's webhook (app/api/webhooks/resend on New-Website-Concept,
-- signed with RESEND_WEBHOOK_SECRET) and read by the admin Email Problems page,
-- so a bad address shows up there instead of failing silently. Only what the
-- admin needs is kept: the address, the email's subject and Resend's reason
-- (no opens, clicks, IP addresses or devices).

create table if not exists email_problems (
  id uuid primary key default gen_random_uuid(),
  -- Resend's webhook message id: a retried delivery is stored once
  event_id text not null,
  -- The recipient, lowercased
  email text not null,
  type text not null check (type in ('bounced', 'complained', 'suppressed', 'failed')),
  subject text,
  detail text,
  resend_email_id text,
  -- When the email was sent, and when Resend told us
  sent_at timestamptz,
  received_at timestamptz not null default now(),
  -- An admin marked it fixed (the address was corrected, or the customer was reached)
  resolved_at timestamptz,
  unique (event_id, email)
);
create index if not exists email_problems_email_idx on email_problems (email);
create index if not exists email_problems_open_idx on email_problems (received_at desc) where resolved_at is null;
alter table email_problems enable row level security;
