-- Refund requests: customer support asks, an admin approves or denies from
-- the Refund Requests tab on /admin. Support staff never see amounts; the
-- admin picks the amount when approving, and the refund itself runs through
-- lib/refunds.ts like any other refund.
create table if not exists public.refund_requests (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders(id) on delete cascade,
  -- 'order': the whole order; 'cards': the cards in card_ids; 'other': described in reason
  scope text not null check (scope in ('order', 'cards', 'other')),
  card_ids uuid[] not null default '{}',
  -- What the customer asked for and why, in support's words
  reason text not null check (length(reason) between 1 and 2000),
  requested_by text not null,
  requested_by_support_id uuid references public.support_access(id) on delete set null,
  -- 'processing' while an admin's approval is talking to Stripe, so it can't run twice
  status text not null default 'pending' check (status in ('pending', 'processing', 'approved', 'denied')),
  decided_by text,
  decided_at timestamptz,
  -- Shown to support: why it was denied, or a note with the approval
  decision_note text,
  refunded_cents integer,
  stripe_refund_ids text[] not null default '{}',
  last_error text,
  created_at timestamptz not null default now()
);
alter table public.refund_requests enable row level security;

-- One open request per order at a time
create unique index if not exists refund_requests_one_open_per_order
  on public.refund_requests (order_id) where status in ('pending', 'processing');
create index if not exists refund_requests_status_created on public.refund_requests (status, created_at);
