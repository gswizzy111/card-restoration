-- Dashboard metrics: refund ledger, card backlog history, daily reports.
-- Shared database: the same file is in both repos (card-restoration and New-Website-Concept).
--
-- 1. refunds         one row per Stripe refund (or a refund paid outside Stripe), dated
--                    when the money went back. The dashboard's refund figures read only this.
-- 2. backlog_events  insert-only history written by triggers on orders and cards, so the
--                    backlog can be replayed exactly from the moment this migration ran.
--                    Earlier days are rebuilt from order_events and flagged by data quality.
-- 3. backlog_daily   each finished day's backlog row, saved the first time it is computed.
-- 4. report functions (all days are America/New_York calendar days):
--      backlog_compute(from, to)  rebuild days from history (no writes)
--      backlog_report(from, to)   saved rows for finished days, live row for today (saves new days)
--      service_report(from, to)   PSA Prep vs Full Restoration orders, cards, revenue per day
--      revenue_series()           daily and hourly sales and refunds for the revenue charts
-- All return jsonb so PostgREST's row limit never cuts a report short.

-- ── Settings ─────────────────────────────────────────────────────────────────
create table if not exists metrics_settings (
  key text primary key,
  value_ts timestamptz,
  updated_at timestamptz not null default now()
);
alter table metrics_settings enable row level security;
-- When exact backlog history starts (triggers below); days before it are rebuilt.
insert into metrics_settings (key, value_ts) values ('backlog_tracking_start', now())
  on conflict (key) do nothing;

-- ── Refund ledger ────────────────────────────────────────────────────────────
create table if not exists refunds (
  id uuid primary key default gen_random_uuid(),
  source text not null default 'stripe' check (source in ('stripe', 'manual')),
  stripe_refund_id text unique,
  stripe_charge_id text,
  stripe_payment_intent_id text,
  amount_cents integer not null check (amount_cents > 0),
  currency text not null default 'usd',
  status text not null check (status in ('pending', 'requires_action', 'succeeded', 'failed', 'canceled')),
  refunded_at timestamptz not null,
  order_id uuid references orders(id) on delete set null,
  shop_order_id uuid references shop_orders(id) on delete set null,
  card_id uuid references cards(id) on delete set null,
  kind text not null check (kind in ('restoration', 'prep', 'kit', 'kit_club', 'other', 'unmatched')),
  match_method text,
  reason text,
  note text,
  created_by text,
  synced_at timestamptz not null default now(),
  check (source = 'manual' or stripe_refund_id is not null)
);
create index if not exists refunds_refunded_at_idx on refunds (refunded_at);
create index if not exists refunds_order_id_idx on refunds (order_id);
create index if not exists refunds_shop_order_id_idx on refunds (shop_order_id);
alter table refunds enable row level security;

-- ── Backlog history ──────────────────────────────────────────────────────────
alter table cards add column if not exists completed_at timestamptz;

create table if not exists backlog_events (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  order_id uuid not null,              -- no foreign key: history outlives deleted orders
  card_id uuid,                        -- null for order events
  event text not null check (event in ('order_status', 'card_added', 'card_removed',
                                        'card_completed', 'card_uncompleted', 'card_refunded')),
  status text,                         -- order_status: the new status ('deleted' when the order is deleted)
  card_created_at timestamptz,         -- card events: when the card row was created
  source text not null default 'live' check (source in ('live', 'baseline'))
);
create index if not exists backlog_events_order_idx on backlog_events (order_id, at);
create index if not exists backlog_events_card_idx on backlog_events (card_id, at);
alter table backlog_events enable row level security;
create or replace trigger backlog_events_immutable before update or delete on backlog_events
  for each row execute function forbid_change();

-- Logging never blocks the order or card write that triggered it.
create or replace function log_order_status() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    insert into backlog_events (order_id, event, status) values (old.id, 'order_status', 'deleted');
  elsif tg_op = 'INSERT' or new.status is distinct from old.status then
    insert into backlog_events (order_id, event, status) values (new.id, 'order_status', new.status);
  end if;
  return null;
exception when others then
  raise warning 'backlog_events: order % not logged: %', tg_op, sqlerrm;
  return null;
end $$;
create or replace trigger orders_backlog_history after insert or update of status or delete on orders
  for each row execute function log_order_status();

create or replace function stamp_card_completed() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    if new.completed and new.completed_at is null then new.completed_at := now(); end if;
  elsif new.completed is distinct from old.completed then
    new.completed_at := case when new.completed then now() else null end;
  end if;
  return new;
end $$;
create or replace trigger cards_completed_at before insert or update of completed on cards
  for each row execute function stamp_card_completed();

create or replace function log_card_change() returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    insert into backlog_events (order_id, card_id, event, card_created_at)
      values (new.order_id, new.id, 'card_added', new.created_at);
    if new.completed then
      insert into backlog_events (order_id, card_id, event, card_created_at)
        values (new.order_id, new.id, 'card_completed', new.created_at);
    end if;
  elsif tg_op = 'DELETE' then
    insert into backlog_events (order_id, card_id, event, card_created_at)
      values (old.order_id, old.id, 'card_removed', old.created_at);
  else
    if new.order_id is distinct from old.order_id then
      insert into backlog_events (order_id, card_id, event, card_created_at) values
        (old.order_id, old.id, 'card_removed', old.created_at),
        (new.order_id, new.id, 'card_added', new.created_at);
    end if;
    if new.completed is distinct from old.completed then
      insert into backlog_events (order_id, card_id, event, card_created_at)
        values (new.order_id, new.id, case when new.completed then 'card_completed' else 'card_uncompleted' end, new.created_at);
    end if;
    if new.status = 'refunded' and old.status is distinct from 'refunded' then
      insert into backlog_events (order_id, card_id, event, card_created_at)
        values (new.order_id, new.id, 'card_refunded', new.created_at);
    end if;
  end if;
  return null;
exception when others then
  raise warning 'backlog_events: card % not logged: %', tg_op, sqlerrm;
  return null;
end $$;
create or replace trigger cards_backlog_history after insert or update or delete on cards
  for each row execute function log_card_change();

-- Baseline: every order's status and every ticked card as of now, so the live history
-- starts from the same state the rebuilt history ends in. Cards already ticked done
-- leave the backlog here, flagged as finished at an unrecorded time.
insert into backlog_events (at, order_id, event, status, source)
select (select value_ts from metrics_settings where key = 'backlog_tracking_start'), id, 'order_status', status, 'baseline'
from orders
where not exists (select 1 from backlog_events where source = 'baseline');
insert into backlog_events (at, order_id, card_id, event, card_created_at, source)
select (select value_ts from metrics_settings where key = 'backlog_tracking_start'), order_id, id, 'card_completed', created_at, 'baseline'
from cards
where completed
  and not exists (select 1 from backlog_events where source = 'baseline' and event = 'card_completed');

create table if not exists backlog_daily (
  day date primary key,
  data jsonb not null,                 -- the day's row as backlog_compute returns it
  computed_at timestamptz not null default now()
);
alter table backlog_daily enable row level security;

-- ── Shared helpers ───────────────────────────────────────────────────────────
-- Start of an America/New_York calendar day as a timestamp.
create or replace function et_day_start(d date) returns timestamptz language sql immutable as $$
  select d::timestamp at time zone 'America/New_York'
$$;

-- PSA Prep or Full Restoration. May 2026 orders without a tier whose only service lines
-- were "PSA Prep" were prep orders; every other order without a tier is a mixed-tier or
-- manual restoration order.
create or replace function order_service(p_order_id uuid, p_tier text) returns text language sql stable as $$
  select case
    when p_tier in ('prep', 'prep_standard') then 'prep'
    when p_tier is null and exists (select 1 from order_services s where s.order_id = p_order_id and s.service_name = 'PSA Prep')
      and not exists (select 1 from order_services s where s.order_id = p_order_id
        and s.service_name <> 'PSA Prep'
        and coalesce(s.service_id, '') not in ('pregrade', 'pre_grade_assessment', 'slab_crack', 'instagram_feature'))
      then 'prep'
    else 'restoration'
  end
$$;

-- Cards on an order: its card rows, or for manual orders entered without card rows,
-- the quantity on its service lines (null when neither tells).
create or replace function order_card_count(p_order_id uuid) returns integer language sql stable as $$
  select coalesce(
    nullif((select count(*)::int from cards c where c.order_id = p_order_id), 0),
    nullif((select coalesce(sum(s.quantity), 0)::int from order_services s where s.order_id = p_order_id
      and coalesce(s.service_id, '') not in ('pregrade', 'pre_grade_assessment', 'slab_crack', 'instagram_feature')), 0)
  )
$$;

-- ── Backlog: rebuild days ────────────────────────────────────────────────────
-- A card is in the backlog while its order is Cards Received, In Progress or Awaiting
-- Restoration, the order is paid, the card exists, isn't ticked done and isn't refunded.
-- Before backlog_tracking_start, order statuses come from order_events (the status
-- notes the site has always written); from then on, from backlog_events.
create or replace function backlog_compute(p_from date, p_to date) returns jsonb language sql stable as $$
with
cfg as (
  select coalesce((select value_ts from metrics_settings where key = 'backlog_tracking_start'), now()) t0,
         (now() at time zone 'America/New_York')::date today
),
notes as (
  -- Order statuses the site wrote as notes before tracking started
  select e.order_id, e.created_at t,
    case
      when e.event_type = 'manual_order_created' then
        case when e.description ilike 'Drop-off order created%' then 'received' end
      when e.description = 'Status updated to: Awaiting Payment' then 'awaiting_payment'
      when e.description = 'Status updated to: Awaiting Cards' then 'awaiting_cards'
      when e.description = 'Status updated to: Cards Received' then 'received'
      when e.description = 'Status updated to: In Progress' then 'in_progress'
      when e.description = 'Status updated to: Awaiting Restoration' then 'awaiting_restoration'
      when e.description = 'Status updated to: Completed' then 'completed'
      when e.description ilike '%Shipped Back%' then 'shipped_back'
      when e.description ilike 'Marked Delivered%' or e.description = 'Status updated to: Delivered' then 'delivered'
      when e.description = 'Status updated to: Cancelled' then 'cancelled'
    end st
  from order_events e, cfg
  where e.event_type in ('status_updated', 'manual_order_created') and e.created_at < cfg.t0
),
last_note as (
  select distinct on (order_id) order_id, t, st from notes where st is not null order by order_id, t desc
),
pts as (
  select order_id, t, st, 'note' src from notes where st is not null
  union all
  -- Orders already cancelled when tracking started, with no note saying so: cancelled
  -- when last refunded, if that came after their last note
  select b.order_id,
    least(greatest(
      case when r.t is not null and (ln.t is null or r.t >= ln.t) then r.t else least(o.updated_at, cfg.t0) end,
      coalesce(ln.t + interval '1 millisecond', '-infinity'::timestamptz)
    ), cfg.t0 - interval '1 millisecond'),
    'cancelled', 'note'
  from backlog_events b
  cross join cfg
  left join orders o on o.id = b.order_id
  left join last_note ln on ln.order_id = b.order_id
  left join lateral (select max(e.created_at) t from order_events e
    where e.order_id = b.order_id and e.event_type = 'refund_issued' and e.created_at < cfg.t0) r on true
  where b.source = 'baseline' and b.event = 'order_status' and b.status = 'cancelled'
    and ln.st is distinct from 'cancelled'
  union all
  -- Recorded statuses from tracking start (the baseline row holds each order's status then)
  select b.order_id, b.at, b.status, b.source
  from backlog_events b, cfg
  where b.event = 'order_status' and b.at >= cfg.t0
),
ords as (
  -- Paid orders, and orders since deleted (their recorded history is kept)
  select o.id, o.created_at, order_service(o.id, o.restoration_tier) svc
  from orders o where o.payment_status in ('paid', 'refunded')
  union all
  select d.order_id, min(d.at), 'restoration'
  from backlog_events d
  where not exists (select 1 from orders o where o.id = d.order_id)
  group by d.order_id
),
first_card as (
  select order_id, min(t) t from (
    select order_id, created_at t from cards
    union all
    select order_id, card_created_at from backlog_events
    where event in ('card_added', 'card_removed') and card_created_at is not null
  ) x group by order_id
),
late as (
  -- Orders whose card rows were entered after the order (manual orders entered without
  -- them): until then, their service-line quantity stands in for the cards
  select o.id, o.created_at, fc.t switch_at,
    (select coalesce(sum(s.quantity), 0)::int from order_services s where s.order_id = o.id
      and coalesce(s.service_id, '') not in ('pregrade', 'pre_grade_assessment', 'slab_crack', 'instagram_feature')) q
  from ords o left join first_card fc on fc.order_id = o.id
  where fc.t is null or fc.t > o.created_at + interval '10 minutes'
),
units as (
  -- One unit per card row, including cards since removed
  select c.id::text uid, c.id card_id, c.order_id, c.created_at born, false unknown, null::timestamptz ends,
    case when l.switch_at = c.created_at then 'recount' end born_src
  from cards c join ords o on o.id = c.order_id left join late l on l.id = c.order_id
  union all
  select r.*, case when l.switch_at = r.born then 'recount' end
  from (
    select distinct on (b.card_id) b.card_id::text uid, b.card_id, b.order_id, b.card_created_at born, false unknown, null::timestamptz ends
    from backlog_events b join ords o on o.id = b.order_id
    where b.event = 'card_removed' and not exists (select 1 from cards c where c.id = b.card_id)
    order by b.card_id, b.at
  ) r left join late l on l.id = r.order_id
  union all
  -- Service-line quantity until the cards were entered
  select l.id::text || '#' || g, null::uuid, l.id, l.created_at, false, l.switch_at, null
  from late l cross join lateral generate_series(1, l.q) g
  where l.q > 0
  union all
  -- ... and when that doesn't tell either, one placeholder so the day can say a count is unknown
  select l.id::text || '#?', null::uuid, l.id, l.created_at, true, l.switch_at, null
  from late l where l.q = 0
),
card_ev as (
  select card_id, at, event, source from backlog_events
  where card_id is not null and event in ('card_added', 'card_removed', 'card_completed', 'card_uncompleted', 'card_refunded')
),
ev as (
  -- seq orders same-instant events: existence, then status, then card ticks, then refunds
  select u.uid, u.born t, 0 seq, 'born' kind, null::text st, u.born_src src from units u
  union all
  select u.uid, u.ends, 0, 'removed', null, 'recount' from units u where u.ends is not null
  union all
  -- a card moved between orders is removed from one and added to the other
  select u.uid, b.at, 0, case b.event when 'card_added' then 'born' else 'removed' end, null, null
  from units u join card_ev b on b.card_id = u.card_id and b.event in ('card_added', 'card_removed')
  union all
  select u.uid, p.t, 1, 'status', p.st, p.src from units u join pts p on p.order_id = u.order_id where p.st is not null
  union all
  select u.uid, b.at, 2, case b.event when 'card_completed' then 'done' else 'undone' end, null, b.source
  from units u join card_ev b on b.card_id = u.card_id and b.event in ('card_completed', 'card_uncompleted')
  union all
  select u.uid, coalesce(b.at, c.refunded_at, c.created_at), 3, 'refund', null, null
  from units u
  left join cards c on c.id = u.card_id and c.status = 'refunded'
  left join card_ev b on b.card_id = u.card_id and b.event = 'card_refunded'
  where u.card_id is not null and (c.id is not null or b.card_id is not null)
),
grp as (
  select ev.*,
    row_number() over w rn,
    count(*) filter (where kind = 'status') over w gs,
    count(*) filter (where kind in ('born', 'removed')) over w ge,
    count(*) filter (where kind in ('done', 'undone')) over w gd,
    count(*) filter (where kind = 'refund') over w gr
  from ev
  window w as (partition by uid order by t, seq, kind = 'born' rows unbounded preceding)
),
state as (
  select uid, t, rn, kind, src,
    max(st) over (partition by uid, gs) cur_status,
    coalesce(max(case kind when 'born' then 1 when 'removed' then 0 end) over (partition by uid, ge), 0) = 1 present,
    coalesce(max(case kind when 'done' then 1 when 'undone' then 0 end) over (partition by uid, gd), 0) = 1 done,
    gr > 0 refunded
  from grp
),
per_t as (
  -- State after every event at one instant, and which kinds of events happened then
  select uid, t,
    (array_agg(cur_status order by rn desc))[1] cur_status,
    bool_or(kind = 'status') has_status, bool_or(kind = 'status' and src = 'baseline') has_baseline,
    bool_or(kind = 'born') has_born, bool_or(kind = 'removed') has_removed, bool_or(src = 'recount') has_recount,
    bool_or(kind = 'done' and src = 'baseline') has_done_untracked, bool_or(kind = 'done' and coalesce(src, 'live') = 'live') has_done,
    bool_or(kind = 'refund') has_refund,
    coalesce((array_agg(cur_status order by rn desc))[1] in ('received', 'in_progress', 'awaiting_restoration'), false)
      and (array_agg(present order by rn desc))[1]
      and not (array_agg(done order by rn desc))[1]
      and not (array_agg(refunded order by rn desc))[1] inb
  from state
  group by uid, t
),
seqd as (
  select p.*,
    lag(inb, 1, false) over (partition by uid order by t) prev_inb,
    lag(cur_status) over (partition by uid order by t) prev_status
  from per_t p
),
tr as (
  -- Every move into or out of the backlog, with its reason
  select s.uid, s.t, (s.t at time zone 'America/New_York')::date d, s.inb up, s.cur_status, s.prev_status,
    case
      when s.has_recount then 'recount'
      when s.inb and s.has_baseline then 'recount'
      when s.inb and s.has_status and s.prev_status in ('completed', 'shipped_back', 'delivered') then 'reopened'
      when s.inb and s.has_status then 'received'
      when s.inb and s.has_born then 'added'
      when s.inb then 'reopened'
      when s.has_refund then 'removed'
      when s.has_done then 'completed'
      when s.has_done_untracked then 'untracked'
      when s.has_status and s.cur_status in ('completed', 'shipped_back', 'delivered') then 'completed'
      when s.has_status and s.cur_status in ('awaiting_cards', 'awaiting_payment') then 'sent_back'
      else 'removed'
    end reason
  from seqd s
  where s.inb is distinct from s.prev_inb
),
unit_info as (
  select u.uid, u.unknown, o.svc = 'prep' prep, o.created_at order_created, u.order_id
  from units u join ords o on o.id = u.order_id
),
-- Possible undercount: cards whose arrival wasn't logged (the order skipped "Cards
-- Received", first showed up open when tracking began, or closed without ever being
-- open) could have been in the shop from the order date until the first logged status.
uncertain as (
  select f.uid, ui.order_created a, f.t b
  from (select distinct on (uid) uid, t, cur_status, reason from tr where up order by uid, t) f
  join unit_info ui on ui.uid = f.uid
  cross join cfg
  where not ui.unknown
    and ((f.reason = 'received' and f.cur_status <> 'received') or (f.reason = 'recount' and f.t = cfg.t0))
  union all
  select ui.uid, ui.order_created, min(p.t)
  from unit_info ui
  join pts p on p.order_id = ui.order_id and p.st in ('completed', 'shipped_back', 'delivered')
  where not ui.unknown and not exists (select 1 from tr where tr.uid = ui.uid and tr.up)
  group by ui.uid, ui.order_created
),
deltas as (
  select t.d,
    count(*) filter (where t.up and t.reason in ('received', 'added') and not ui.unknown) added,
    count(*) filter (where not t.up and t.reason = 'completed' and not ui.unknown) completed,
    count(*) filter (where t.up and t.reason = 'reopened' and not ui.unknown) reopened,
    count(*) filter (where not t.up and t.reason = 'sent_back' and not ui.unknown) sent_back,
    count(*) filter (where not t.up and t.reason = 'removed' and not ui.unknown) removed,
    count(*) filter (where not t.up and t.reason = 'untracked' and not ui.unknown) untracked,
    coalesce(sum(case when t.up then 1 else -1 end) filter (where t.reason = 'recount' and not ui.unknown), 0) recount,
    coalesce(sum(case when t.up then 1 else -1 end) filter (where not ui.unknown), 0) dtotal,
    coalesce(sum(case when t.up then 1 else -1 end) filter (where not ui.unknown and ui.prep), 0) dprep,
    coalesce(sum(case when t.up then 1 else -1 end) filter (where ui.unknown), 0) dunknown
  from tr t join unit_info ui on ui.uid = t.uid
  group by t.d
),
alldays as (
  select g::date d, cfg.t0, cfg.today
  from cfg, generate_series(least(p_from, (select min(d) from tr)), least(p_to, cfg.today), interval '1 day') g
),
cum as (
  select a.d, a.t0, a.today,
    coalesce(x.added, 0) added, coalesce(x.completed, 0) completed, coalesce(x.reopened, 0) reopened,
    coalesce(x.sent_back, 0) sent_back, coalesce(x.removed, 0) removed, coalesce(x.untracked, 0) untracked,
    coalesce(x.recount, 0) recount,
    sum(coalesce(x.dtotal, 0)) over (order by a.d) total,
    sum(coalesce(x.dprep, 0)) over (order by a.d) prep,
    sum(coalesce(x.dunknown, 0)) over (order by a.d) unknown_orders
  from alldays a left join deltas x on x.d = a.d
),
unc as (
  select c.d, count(*) n
  from cum c join uncertain u on u.a < et_day_start(c.d + 1) and u.b >= et_day_start(c.d + 1)
  where c.d between p_from and p_to
  group by c.d
),
-- Possible overcount: cards whose order went from Cards Received / In Progress straight
-- to Delivered more than a week later; when they were really finished wasn't logged.
stale as (
  select x.uid, x.a, x.t b
  from (select tr.*, lag(tr.t) over (partition by tr.uid order by tr.t) a from tr) x
  join unit_info ui on ui.uid = x.uid
  where not x.up and not ui.unknown and x.reason = 'completed' and x.cur_status = 'delivered'
    and x.prev_status in ('received', 'in_progress', 'awaiting_restoration') and x.t - x.a > interval '7 days'
),
stl as (
  select c.d, count(*) n
  from cum c join stale s on s.a < et_day_start(c.d + 1) and s.b >= et_day_start(c.d + 1)
  where c.d between p_from and p_to
  group by c.d
),
first_point as (
  select min((t at time zone 'America/New_York')::date) d from pts where st is not null
)
select coalesce(jsonb_agg(jsonb_build_object(
    'day', c.d,
    'total', c.total,
    'prep', c.prep,
    'added', c.added,
    'completed', c.completed,
    'reopened', c.reopened,
    'sent_back', c.sent_back,
    'removed', c.removed,
    'untracked', c.untracked,
    'recount', c.recount,
    'unknown_orders', c.unknown_orders,
    'uncertain', coalesce(un.n, 0),
    'stale', coalesce(sl.n, 0),
    'quality', case
      when fp.d is null or c.d < fp.d then 'no_data'
      when coalesce(un.n, 0)::numeric / greatest(c.total + coalesce(un.n, 0), 1) > 0.10 then 'insufficient'
      when coalesce(un.n, 0)::numeric / greatest(c.total + coalesce(un.n, 0), 1) > 0.03 then 'approximate'
      when coalesce(sl.n, 0)::numeric / greatest(c.total, 1) > 0.03 then 'approximate'
      when et_day_start(c.d + 1) <= c.t0 then 'reconstructed'
      when c.d = c.today then 'live'
      else 'recorded'
    end
  ) order by c.d), '[]'::jsonb)
from cum c
cross join first_point fp
left join unc un on un.d = c.d
left join stl sl on sl.d = c.d
where c.d between p_from and p_to
$$;

-- Saved rows for finished days (saving any not yet saved), a live row for today.
create or replace function backlog_report(p_from date, p_to date) returns jsonb language plpgsql as $$
declare
  today date := (now() at time zone 'America/New_York')::date;
  missing date;
  computed jsonb;
begin
  select min(g::date) into missing
  from generate_series(p_from, least(p_to, today), interval '1 day') g
  where g::date = today or not exists (select 1 from backlog_daily b where b.day = g::date);
  if missing is not null then
    computed := backlog_compute(missing, least(p_to, today));
    insert into backlog_daily (day, data)
    select (r->>'day')::date, r from jsonb_array_elements(computed) r
    where (r->>'day')::date < today
    on conflict (day) do nothing;
  end if;
  return (
    select coalesce(jsonb_agg(row_data order by day), '[]'::jsonb) from (
      select b.day, b.data row_data from backlog_daily b where b.day between p_from and least(p_to, today - 1)
      union all
      select (r->>'day')::date, r from jsonb_array_elements(coalesce(computed, '[]'::jsonb)) r where (r->>'day')::date = today
    ) x
  );
end $$;

-- ── PSA Prep vs Full Restoration, per day ────────────────────────────────────
-- Paid orders on the day payment arrived. Cards added to an order later, and tier
-- upgrades, are counted on the day they were paid, under the order's service, and
-- taken out of the order's own day so no dollar is counted twice.
create or replace function service_report(p_from date, p_to date) returns jsonb language sql stable as $$
with
o as (
  select o.id, o.total_cents, order_service(o.id, o.restoration_tier) svc,
    coalesce((select min(e.created_at) from order_events e where e.order_id = o.id and e.event_type = 'payment_received'), o.created_at) paid_at,
    order_card_count(o.id) ncards
  from orders o
  where o.payment_status in ('paid', 'refunded') and o.status <> 'awaiting_payment'
),
addon as (
  select e.order_id, e.created_at t,
    coalesce(round(replace(substring(e.description from '\$([0-9,]+\.[0-9]{2})'), ',', '')::numeric * 100)::int, 0) cents,
    coalesce(substring(e.description from 'added ([0-9]+) card')::int, 0) ncards
  from order_events e
  where e.event_type in ('cards_added', 'tier_upgraded')
),
rows as (
  select (o.paid_at at time zone 'America/New_York')::date d, o.svc, 1 orders,
    case when o.ncards is null then null else o.ncards - coalesce((select sum(a.ncards) from addon a where a.order_id = o.id), 0) end cards,
    o.total_cents - coalesce((select sum(a.cents) from addon a where a.order_id = o.id), 0) cents
  from o
  union all
  select (a.t at time zone 'America/New_York')::date, o.svc, 0, a.ncards, a.cents
  from addon a join o on o.id = a.order_id
),
days as (
  select g::date d from generate_series(p_from, least(p_to, (now() at time zone 'America/New_York')::date), interval '1 day') g
),
per_day as (
  select dd.d,
    coalesce(sum(r.orders) filter (where r.svc = 'prep'), 0) prep_orders,
    coalesce(sum(r.cards) filter (where r.svc = 'prep'), 0) prep_cards,
    coalesce(sum(r.cents) filter (where r.svc = 'prep'), 0) prep_cents,
    coalesce(sum(r.orders) filter (where r.svc = 'restoration'), 0) restoration_orders,
    coalesce(sum(r.cards) filter (where r.svc = 'restoration'), 0) restoration_cards,
    coalesce(sum(r.cents) filter (where r.svc = 'restoration'), 0) restoration_cents,
    count(*) filter (where r.orders = 1 and r.cards is null) unknown_card_orders
  from days dd
  left join rows r on r.d = dd.d
  group by dd.d
)
select coalesce(jsonb_agg(jsonb_build_object(
    'day', d,
    'prep_orders', prep_orders, 'prep_cards', prep_cards, 'prep_cents', prep_cents,
    'restoration_orders', restoration_orders, 'restoration_cards', restoration_cards, 'restoration_cents', restoration_cents,
    'unknown_card_orders', unknown_card_orders
  ) order by d), '[]'::jsonb)
from per_day
$$;

-- ── Revenue and refunds for the dashboard charts ─────────────────────────────
-- Sales: paid service orders on the day paid (add-on payments on their own day) and
-- kit orders on the day placed. Refunds: the refund ledger, on the day refunded
-- (pending refunds included, failed and canceled ones not).
create or replace function revenue_series() returns jsonb language sql stable as $$
with
o as (
  select o.id, o.total_cents,
    coalesce((select min(e.created_at) from order_events e where e.order_id = o.id and e.event_type = 'payment_received'), o.created_at) paid_at
  from orders o
  where o.payment_status in ('paid', 'refunded') and o.status <> 'awaiting_payment'
),
addon as (
  select e.order_id, e.created_at t,
    coalesce(round(replace(substring(e.description from '\$([0-9,]+\.[0-9]{2})'), ',', '')::numeric * 100)::int, 0) cents
  from order_events e
  where e.event_type in ('cards_added', 'tier_upgraded')
),
sales as (
  select o.paid_at t, 'service' kind, 1 orders,
    o.total_cents - coalesce((select sum(a.cents) from addon a where a.order_id = o.id), 0) cents
  from o
  union all
  select a.t, 'service', 0, a.cents from addon a join o on o.id = a.order_id
  union all
  select s.created_at, 'kit', 1, s.total_cents from shop_orders s
),
refs as (
  select r.refunded_at t, case when r.kind in ('kit', 'kit_club') then 'kit' else 'service' end kind,
    r.amount_cents cents, r.status = 'pending' pending
  from refunds r where r.status in ('succeeded', 'pending', 'requires_action')
),
daily as (
  select d,
    sum(sales_cents) sales_cents, sum(orders) orders, sum(refund_cents) refund_cents, sum(pending_cents) pending_cents,
    sum(kit_sales_cents) kit_sales_cents, sum(kit_orders) kit_orders, sum(kit_refund_cents) kit_refund_cents
  from (
    select (t at time zone 'America/New_York')::date d, cents sales_cents, orders, 0 refund_cents, 0 pending_cents,
      case when kind = 'kit' then cents else 0 end kit_sales_cents, case when kind = 'kit' then orders else 0 end kit_orders, 0 kit_refund_cents
    from sales
    union all
    select (t at time zone 'America/New_York')::date, 0, 0, cents, case when pending then cents else 0 end,
      0, 0, case when kind = 'kit' then cents else 0 end
    from refs
  ) x
  group by d
),
hourly as (
  select h,
    sum(sales_cents) sales_cents, sum(orders) orders, sum(refund_cents) refund_cents,
    sum(kit_sales_cents) kit_sales_cents, sum(kit_orders) kit_orders, sum(kit_refund_cents) kit_refund_cents
  from (
    select date_trunc('hour', t at time zone 'America/New_York') h, cents sales_cents, orders, 0 refund_cents,
      case when kind = 'kit' then cents else 0 end kit_sales_cents, case when kind = 'kit' then orders else 0 end kit_orders, 0 kit_refund_cents
    from sales where t >= now() - interval '25 hours'
    union all
    select date_trunc('hour', t at time zone 'America/New_York'), 0, 0, cents, 0, 0, case when kind = 'kit' then cents else 0 end
    from refs where t >= now() - interval '25 hours'
  ) x
  group by h
)
select jsonb_build_object(
  'today', (now() at time zone 'America/New_York')::date,
  'now_hour', date_trunc('hour', now() at time zone 'America/New_York'),
  'daily', coalesce((select jsonb_agg(jsonb_build_object(
      'day', d, 'sales_cents', sales_cents, 'orders', orders, 'refund_cents', refund_cents, 'pending_refund_cents', pending_cents,
      'kit_sales_cents', kit_sales_cents, 'kit_orders', kit_orders, 'kit_refund_cents', kit_refund_cents) order by d) from daily), '[]'::jsonb),
  'hourly', coalesce((select jsonb_agg(jsonb_build_object(
      'hour', h, 'sales_cents', sales_cents, 'orders', orders, 'refund_cents', refund_cents,
      'kit_sales_cents', kit_sales_cents, 'kit_orders', kit_orders, 'kit_refund_cents', kit_refund_cents) order by h) from hourly), '[]'::jsonb),
  'refunds_this_month', (
    select jsonb_build_object('count', count(*), 'cents', coalesce(sum(cents), 0), 'pending_cents', coalesce(sum(cents) filter (where pending), 0))
    from refs where t >= date_trunc('month', now() at time zone 'America/New_York') at time zone 'America/New_York'
  )
)
$$;

-- ── The backlog right now (same definition as backlog_compute's live row) ────
create or replace function backlog_now() returns jsonb language sql stable as $$
with open_orders as (
  select o.id, order_service(o.id, o.restoration_tier) svc
  from orders o
  where o.status in ('received', 'in_progress', 'awaiting_restoration') and o.payment_status in ('paid', 'refunded')
),
counts as (
  select oo.id, oo.svc,
    case
      when exists (select 1 from cards c where c.order_id = oo.id)
        then (select count(*) from cards c where c.order_id = oo.id and not c.completed and coalesce(c.status, '') <> 'refunded')
      -- every card row was deleted
      when exists (select 1 from backlog_events b where b.order_id = oo.id and b.event in ('card_added', 'card_removed')) then 0
      else order_card_count(oo.id)
    end n
  from open_orders oo
)
select jsonb_build_object(
  'total', coalesce(sum(n), 0),
  'prep', coalesce(sum(n) filter (where svc = 'prep'), 0),
  'orders', count(*) filter (where n > 0),
  'unknown_orders', count(*) filter (where n is null),
  'as_of', now(),
  'tracking_start', (select value_ts from metrics_settings where key = 'backlog_tracking_start')
) from counts
$$;

-- Only the server (service role) calls these.
revoke execute on function backlog_compute(date, date), backlog_report(date, date), service_report(date, date),
  revenue_series(), backlog_now(), order_service(uuid, text), order_card_count(uuid), et_day_start(date)
  from public, anon, authenticated;
