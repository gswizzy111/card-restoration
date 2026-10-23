import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin dashboard numbers, computed in the database (supabase/migrations/
 * 20261023_dashboard_metrics.sql) so every report reads the whole history
 * (no 1,000-row API limit) and every day is an America/New_York calendar day.
 * - Refunds come from the refund ledger (lib/refund-ledger.ts), dated when the
 *   money went back.
 * - The backlog counts unfinished cards, not orders: cards in paid orders that
 *   are Cards Received / In Progress, not ticked done and not refunded.
 * - Prep vs Restoration counts each paid order once, under its own service, on
 *   the day it was paid.
 */

export const BUSINESS_TIME_ZONE = "America/New_York";

/** Today's date in New York as YYYY-MM-DD. */
export function etToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: BUSINESS_TIME_ZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

/** A YYYY-MM-DD date moved by whole days. */
export function addDays(day: string, n: number): string {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

/** "Oct 23" or "Fri, Oct 23" for a YYYY-MM-DD date. */
export function formatDay(day: string, opts: Intl.DateTimeFormatOptions = { month: "short", day: "numeric" }): string {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

/** How well a backlog day is known. */
export type BacklogQuality =
  | "live"           // today, as of now
  | "recorded"       // every move logged as it happened
  | "reconstructed"  // rebuilt from order status history
  | "approximate"    // rebuilt; up to 10% of cards may be missing (arrival not logged)
  | "insufficient"   // rebuilt; too many cards with unlogged arrivals to give a number
  | "no_data";       // before the site logged order statuses

export type BacklogDay = {
  day: string;
  total: number;          // unfinished cards at the end of the day
  prep: number;           // of which PSA Prep
  added: number;          // cards received (or added to an order already in)
  completed: number;      // cards ticked done, or their order completed/shipped/delivered
  reopened: number;       // cards back in after being done
  sent_back: number;      // order moved back to Awaiting Cards
  removed: number;        // order cancelled or deleted, card refunded or deleted
  untracked: number;      // ticked done before tracking began (finish date not recorded)
  recount: number;        // count corrected: card rows entered on an order counted by quantity, or found when tracking began
  unknown_orders: number; // open orders whose card count isn't known
  uncertain: number;      // cards that may be missing from the total
  stale: number;          // cards that may have been finished earlier (order later marked Delivered straight from Received/In Progress)
  quality: BacklogQuality;
};

export type ServiceDay = {
  day: string;
  prep_orders: number;
  prep_cards: number;
  prep_cents: number;
  restoration_orders: number;
  restoration_cards: number;
  restoration_cents: number;
  unknown_card_orders: number;
};

export type RevenueDay = {
  day: string;
  sales_cents: number;
  orders: number;
  refund_cents: number;
  pending_refund_cents: number;
  kit_sales_cents: number;
  kit_orders: number;
  kit_refund_cents: number;
};

export type RevenueHour = {
  hour: string; // New York local time, "YYYY-MM-DDTHH:00:00"
  sales_cents: number;
  orders: number;
  refund_cents: number;
  kit_sales_cents: number;
  kit_orders: number;
  kit_refund_cents: number;
};

export type RevenueSeries = {
  today: string;
  now_hour: string;
  daily: RevenueDay[];
  hourly: RevenueHour[];
  refunds_this_month: { count: number; cents: number; pending_cents: number };
};

export const QUALITY_LABEL: Record<BacklogQuality, string> = {
  live: "Live",
  recorded: "Recorded",
  reconstructed: "Rebuilt",
  approximate: "Approximate",
  insufficient: "Insufficient data",
  no_data: "No data",
};

/** Whether a backlog day has a number to show. */
export function backlogKnown(d: BacklogDay): boolean {
  return d.quality !== "no_data" && d.quality !== "insufficient";
}

/** Backlog days from..to (YYYY-MM-DD). Finished days are saved the first time they're computed. */
export async function getBacklogDays(admin: SupabaseClient, from: string, to: string): Promise<BacklogDay[]> {
  const { data, error } = await admin.rpc("backlog_report", { p_from: from, p_to: to });
  if (error) throw new Error(`backlog_report: ${error.message}`);
  return (data ?? []) as BacklogDay[];
}

export type BacklogNow = { total: number; prep: number; orders: number; unknown_orders: number; as_of: string; tracking_start: string | null };

/** Unfinished cards right now (a quick count; the same definition as today's backlog row). */
export async function getBacklogNow(admin: SupabaseClient): Promise<BacklogNow> {
  const { data, error } = await admin.rpc("backlog_now");
  if (error) throw new Error(`backlog_now: ${error.message}`);
  return data as BacklogNow;
}

export async function getServiceDays(admin: SupabaseClient, from: string, to: string): Promise<ServiceDay[]> {
  const { data, error } = await admin.rpc("service_report", { p_from: from, p_to: to });
  if (error) throw new Error(`service_report: ${error.message}`);
  return (data ?? []) as ServiceDay[];
}

export async function getRevenueSeries(admin: SupabaseClient): Promise<RevenueSeries> {
  const { data, error } = await admin.rpc("revenue_series");
  if (error) throw new Error(`revenue_series: ${error.message}`);
  return data as RevenueSeries;
}

/** What to say about a backlog day beside its quality label: gaps in the data, and moves besides added/completed. */
export function backlogNotes(d: BacklogDay): string[] {
  const notes: string[] = [];
  const cards = (n: number) => `${n} card${n === 1 ? "" : "s"}`;
  if (d.quality === "no_data") notes.push("Order statuses weren't logged yet");
  if (d.quality === "insufficient") notes.push(`Arrival of ${cards(d.uncertain)} wasn't logged, so no total is given`);
  if (d.quality === "approximate" && d.uncertain) notes.push(`Up to ${cards(d.uncertain)} may be missing (arrival not logged)`);
  if (d.stale && d.quality !== "no_data" && d.quality !== "insufficient") {
    notes.push(`${cards(d.stale)} in orders later marked Delivered straight from Cards Received or In Progress may have been finished earlier`);
  }
  if (d.reopened) notes.push(`+${d.reopened} reopened`);
  if (d.sent_back) notes.push(`−${d.sent_back} order sent back to Awaiting Cards`);
  if (d.removed) notes.push(`−${d.removed} cancelled, refunded or deleted`);
  if (d.untracked) notes.push(`−${d.untracked} ticked done before tracking began (finish dates not recorded)`);
  if (d.recount) notes.push(`${d.recount > 0 ? "+" : "−"}${Math.abs(d.recount)} recounted (card count corrected)`);
  if (d.unknown_orders) notes.push(`${d.unknown_orders} open order${d.unknown_orders === 1 ? "" : "s"} with no card count`);
  return notes;
}
