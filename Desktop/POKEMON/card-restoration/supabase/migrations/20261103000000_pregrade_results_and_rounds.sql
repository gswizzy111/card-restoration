-- Pre-grade results per card, and rounds of restoration work.
-- Applied to production on 2026-11-03.
alter table public.cards
  add column if not exists pregrade_result text,
  add column if not exists pregrade_notes text,
  add column if not exists pregrade_submitted_at timestamptz,
  add column if not exists pregrade_submitted_by text,
  add column if not exists current_round integer not null default 1;

create index if not exists cards_pregrade_idx on public.cards (order_id)
  where pregrade_selected or pregrade_submitted_at is not null;
