-- Customers who send their cards in their own way still pay for the trip
-- back: the carrier and service they paid for, so the return label matches.
-- (Prepaid-label orders keep using inbound_carrier / inbound_service_level,
-- which cover the trip in and back.)
alter table public.orders
  add column if not exists return_carrier text,
  add column if not exists return_service_level text;
