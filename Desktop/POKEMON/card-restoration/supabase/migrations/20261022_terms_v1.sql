-- Terms of Service v1.0: versioned Terms, signatures, consents, high-value
-- agreements, per-card work gates and the unclaimed-property notice log.
-- Additive only, no drops. Shared by both sites (same database). Applied with
-- the Supabase MCP in four parts (terms_v1_fn, terms_v1_versions,
-- terms_v1_items_signatures, terms_v1_consents_hva_notices).

-- A row that must never change once written (signed records, published Terms).
create or replace function forbid_change() returns trigger language plpgsql as $$
begin
  raise exception '% rows are permanent and cannot be %d', tg_table_name, lower(tg_op)
    using errcode = 'check_violation';
end $$;

-- ── Terms versions ──────────────────────────────────────────────────────────
create table if not exists terms_versions (
  id uuid primary key default gen_random_uuid(),
  version text not null unique,
  effective_date date not null,
  content_markdown text not null,
  content_sha256 text not null,
  pdf_url text,
  created_at timestamptz not null default now()
);
alter table terms_versions enable row level security;
create trigger terms_versions_immutable before update or delete on terms_versions
  for each row execute function forbid_change();

-- ── Orders and cards (cards are the order items, one per card) ─────────────
alter table orders
  add column if not exists terms_version_id uuid references terms_versions(id),
  add column if not exists insurance_election text check (insurance_election in ('purchased', 'declined'));

alter table cards
  add column if not exists tier text,
  add column if not exists variation text,
  add column if not exists grading_company text,
  add column if not exists grade text,
  add column if not exists cert_number text,
  add column if not exists known_defects text,
  add column if not exists slab_removal_selected boolean not null default false,
  add column if not exists pregrade_selected boolean not null default false,
  add column if not exists status text not null default 'active'
    check (status in ('active', 'on_hold_high_value', 'in_progress', 'refunded')),
  add column if not exists service_price_cents integer,
  add column if not exists discount_cents integer,
  add column if not exists tax_cents integer,
  add column if not exists cleaning_started_at timestamptz,
  add column if not exists cleaning_started_by text,
  add column if not exists slab_opening_started_at timestamptz,
  add column if not exists slab_opening_started_by text,
  add column if not exists refunded_cents integer not null default 0,
  add column if not exists refunded_at timestamptz;

-- ── Signatures (immutable) ─────────────────────────────────────────────────
create table if not exists signatures (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  order_item_id uuid references cards(id) on delete restrict,
  type text not null check (type in ('master_terms', 'slab_removal', 'high_value')),
  terms_version_id uuid not null references terms_versions(id),
  document_title text not null,
  document_text text not null,
  document_sha256 text not null,
  card_snapshot jsonb,
  typed_full_name text not null,
  email text,
  email_verified boolean not null default false,
  signed_at timestamptz not null default now(),
  ip_address text,
  user_agent text,
  signed_pdf_url text,
  created_at timestamptz not null default now()
);
create index if not exists signatures_order_idx on signatures(order_id);
alter table signatures enable row level security;

-- The signing time is always the database's clock, never a value sent in.
create or replace function signatures_stamp() returns trigger language plpgsql as $$
begin
  new.signed_at := now();
  new.created_at := now();
  return new;
end $$;
create trigger signatures_stamp before insert on signatures
  for each row execute function signatures_stamp();
create trigger signatures_immutable before update or delete on signatures
  for each row execute function forbid_change();

-- ── Consents (only withdrawn_at may change) ────────────────────────────────
create table if not exists consents (
  id uuid primary key default gen_random_uuid(),
  order_id uuid references orders(id) on delete restrict,
  subscription_id uuid references subscriptions(id) on delete restrict,
  email text,
  type text not null check (type in ('esign_records', 'marketing_media', 'marketing_tag_name', 'subscription')),
  granted boolean not null,
  consent_text text not null,
  granted_at timestamptz not null default now(),
  withdrawn_at timestamptz,
  ip_address text,
  user_agent text
);
create index if not exists consents_order_idx on consents(order_id);
alter table consents enable row level security;

create or replace function consents_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'consent records are permanent and cannot be deleted' using errcode = 'check_violation';
  end if;
  if (to_jsonb(new) - 'withdrawn_at') is distinct from (to_jsonb(old) - 'withdrawn_at') then
    raise exception 'only withdrawn_at can change on a consent record' using errcode = 'check_violation';
  end if;
  return new;
end $$;
create trigger consents_guard before update or delete on consents
  for each row execute function consents_guard();
create or replace function consents_stamp() returns trigger language plpgsql as $$
begin
  new.granted_at := now();
  return new;
end $$;
create trigger consents_stamp before insert on consents
  for each row execute function consents_stamp();

-- ── High-Value Card Restoration & Custody Agreements ───────────────────────
create table if not exists high_value_agreements (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  order_item_id uuid not null unique references cards(id) on delete restrict,
  negotiated_terms text not null default '',
  token_hash text,
  sent_at timestamptz,
  customer_signature_id uuid references signatures(id),
  company_signed_by text,
  company_signed_at timestamptz,
  status text not null default 'pending' check (status in ('pending', 'executed', 'declined')),
  declined_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table high_value_agreements enable row level security;

-- Once both sides have signed, the agreement is final.
create or replace function hva_guard() returns trigger language plpgsql as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'high-value agreements are permanent and cannot be deleted' using errcode = 'check_violation';
  end if;
  if old.status = 'executed' then
    raise exception 'an executed high-value agreement cannot be changed' using errcode = 'check_violation';
  end if;
  if old.customer_signature_id is not null and new.negotiated_terms is distinct from old.negotiated_terms then
    raise exception 'the terms cannot change after the customer has signed' using errcode = 'check_violation';
  end if;
  new.updated_at := now();
  return new;
end $$;
create trigger hva_guard before update or delete on high_value_agreements
  for each row execute function hva_guard();

-- ── Unclaimed-property notice log ──────────────────────────────────────────
create table if not exists order_notices (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references orders(id) on delete restrict,
  kind text not null check (kind in ('ready_for_return', 'undeliverable', 'follow_up')),
  channel text not null check (channel in ('email', 'other')),
  note text,
  sent_by text,
  sent_at timestamptz not null default now()
);
create index if not exists order_notices_order_idx on order_notices(order_id);
alter table order_notices enable row level security;
create trigger order_notices_immutable before update or delete on order_notices
  for each row execute function forbid_change();

-- ── Customer problem reports ───────────────────────────────────────────────
alter table cases add column if not exists photo_urls text[] not null default '{}';

-- ── Agreements signed before v1.0 are permanent too ────────────────────────
-- Its foreign key still cascades, but this trigger also fires on the
-- cascaded delete, so deleting an order that has one fails.
create trigger order_agreements_immutable before update or delete on order_agreements
  for each row execute function forbid_change();

-- ── Signed PDFs (private) ──────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('signed-documents', 'signed-documents', false)
on conflict (id) do nothing;
