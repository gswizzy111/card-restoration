-- When an order's cards leave the building (status becomes Shipped Back, or
-- Delivered for hand-backs that skip shipping), tick every card on it that
-- isn't already Done. The tick goes through the normal cards triggers, so
-- completed_at is stamped and backlog_events gets a card_completed row, the
-- same as pressing Mark Done. Refunded cards are left alone.
--
-- It runs in the database so every path that ships an order is covered: the
-- status buttons, buying a return label, and the return-label auto-sync.
-- A failure here only warns; it never stops the order from being shipped.
create or replace function public.complete_cards_on_ship()
returns trigger
language plpgsql
set search_path to 'public'
as $function$
begin
  update cards
     set completed = true
   where order_id = new.id
     and not coalesce(completed, false)
     and coalesce(status, '') <> 'refunded';
  return null;
exception when others then
  raise warning 'complete_cards_on_ship: order % cards not marked done: %', new.id, sqlerrm;
  return null;
end $function$;

drop trigger if exists orders_complete_cards_on_ship on public.orders;
create trigger orders_complete_cards_on_ship
  after update of status on public.orders
  for each row
  when (new.status in ('shipped_back', 'delivered') and new.status is distinct from old.status)
  execute function public.complete_cards_on_ship();
