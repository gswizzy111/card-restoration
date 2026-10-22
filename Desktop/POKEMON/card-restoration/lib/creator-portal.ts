import { cache } from "react";
import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { newToken, sha256, TOKEN_PATTERN } from "@/lib/admin-session";
import { DEFAULT_COMMISSION_PERCENT } from "@/lib/commission";

/**
 * The creator portal (/affiliates): creators sign in with their code and a
 * password they choose through a one-time setup link from the admin (codes
 * are public, so a code alone opens nothing). The cookie holds a random
 * session ID whose SHA-256 is in affiliate_sessions. The portal shows sales
 * totals for the creator's code and never customer details.
 */
export const CREATOR_SESSION_COOKIE = "creator_session";
// Before passwords the cookie held the creator's ID; cleared on sign-in and sign-out
export const LEGACY_CREATOR_COOKIE = "affiliate_session";
export const CREATOR_SESSION_DAYS = 30;
export const SETUP_LINK_DAYS = 7;
export const CREATOR_PASSWORD_MIN = 10;

export { DEFAULT_COMMISSION_PERCENT, formatPercent } from "@/lib/commission";

export type Creator = { id: string; name: string; code: string; discount_percent: number };

// Escape LIKE wildcards so a code is matched literally (case-insensitive)
export function literalCode(code: string) {
  return code.replace(/[\\%_]/g, (c) => `\\${c}`);
}

export async function createCreatorSession(affiliateId: string, userAgent?: string | null) {
  const token = newToken();
  const admin = createAdminClient();
  await admin.from("affiliate_sessions").delete().lt("expires_at", new Date().toISOString());
  const { error } = await admin.from("affiliate_sessions").insert({
    token_hash: await sha256(token),
    affiliate_id: affiliateId,
    expires_at: new Date(Date.now() + CREATOR_SESSION_DAYS * 86400_000).toISOString(),
    user_agent: userAgent?.slice(0, 300) ?? null,
  });
  if (error) throw new Error(`Could not start creator session: ${error.message}`);
  await admin.from("affiliates").update({ portal_last_login_at: new Date().toISOString() }).eq("id", affiliateId);
  const jar = await cookies();
  jar.set(CREATOR_SESSION_COOKIE, token, {
    httpOnly: true, secure: true, sameSite: "lax", path: "/", maxAge: CREATOR_SESSION_DAYS * 86400,
  });
  jar.delete(LEGACY_CREATOR_COOKIE);
}

/** The creator signed in on this request, if any (looked up once per request). */
export const getCreator = cache(async (): Promise<Creator | null> => {
  const jar = await cookies();
  const token = jar.get(CREATOR_SESSION_COOKIE)?.value;
  if (!token || !TOKEN_PATTERN.test(token)) return null;
  const admin = createAdminClient();
  const { data } = await admin
    .from("affiliate_sessions")
    .select("affiliates(id, name, code, discount_percent, password_hash)")
    .eq("token_hash", await sha256(token))
    .gt("expires_at", new Date().toISOString())
    .maybeSingle();
  const raw = data?.affiliates as unknown;
  const a = (Array.isArray(raw) ? raw[0] : raw) as (Creator & { password_hash: string | null }) | null;
  // Turning portal access off (clearing the password) ends sessions too
  if (!a?.password_hash) return null;
  return { id: a.id, name: a.name, code: a.code, discount_percent: a.discount_percent ?? 0 };
});

export async function endCreatorSession() {
  const jar = await cookies();
  const token = jar.get(CREATOR_SESSION_COOKIE)?.value;
  if (token && TOKEN_PATTERN.test(token)) {
    await createAdminClient().from("affiliate_sessions").delete().eq("token_hash", await sha256(token));
  }
  jar.delete(CREATOR_SESSION_COOKIE);
  jar.delete(LEGACY_CREATOR_COOKIE);
}

// ── Sales ─────────────────────────────────────────────────────────────────

/** Whether an order with a creator code earns commission: paid, not cancelled. */
export function countsForCommission(kind: "kit" | "restoration", status: string | null) {
  if (status === "cancelled") return false;
  if (kind === "restoration" && status === "awaiting_payment") return false;
  return true;
}

/** An order's amount after refunds. */
export function netCents(totalCents: number | null, refundedCents: number | null) {
  return Math.max(0, (totalCents ?? 0) - (refundedCents ?? 0));
}

export function commissionCents(cents: number, percent: number) {
  return Math.round((cents * percent) / 100);
}

// ── Commission rates ──────────────────────────────────────────────────────

/**
 * A code's commission rate over time: each row starts at effective_from and
 * runs until the next one. A sale earns the rate in effect when it was placed,
 * so changing a rate "from now on" leaves past sales as they were. No rows
 * means the default rate for every sale.
 */
export type CommissionRate = { percent: number; effective_from: string };

export async function commissionRatesFor(affiliateIds: string[]): Promise<Map<string, CommissionRate[]>> {
  const map = new Map<string, CommissionRate[]>();
  if (!affiliateIds.length) return map;
  const { data } = await createAdminClient()
    .from("affiliate_commission_rates")
    .select("affiliate_id, percent, effective_from")
    .in("affiliate_id", affiliateIds)
    .order("effective_from", { ascending: true });
  for (const r of data ?? []) {
    const list = map.get(r.affiliate_id) ?? [];
    list.push({ percent: Number(r.percent), effective_from: r.effective_from });
    map.set(r.affiliate_id, list);
  }
  return map;
}

/** The rate for a sale placed at `date`. `rates` is sorted oldest first. */
export function rateAt(rates: CommissionRate[] | undefined, date: string) {
  let percent = DEFAULT_COMMISSION_PERCENT;
  const t = new Date(date).getTime();
  for (const r of rates ?? []) {
    if (new Date(r.effective_from).getTime() <= t) percent = r.percent;
    else break;
  }
  return percent;
}

/** The rate new sales earn today. */
export function currentRate(rates: CommissionRate[] | undefined) {
  return rateAt(rates, new Date().toISOString());
}


export type CreatorSale = {
  date: string;
  type: "kit" | "restoration";
  cents: number;
  /** The commission rate in effect when the order was placed */
  percent: number;
  commissionCents: number;
  /** What was bought (product names for kits); never who bought it. */
  summary: string;
};

/**
 * Sales made with a creator's code, newest first. Selects only the columns
 * the portal shows: no names, emails, addresses or order numbers.
 */
export async function creatorSales(code: string, rates: CommissionRate[] | undefined): Promise<CreatorSale[]> {
  const admin = createAdminClient();
  const match = literalCode(code);
  const [{ data: kits }, { data: restorations }] = await Promise.all([
    admin.from("shop_orders").select("items, total_cents, refunded_cents, status, created_at").ilike("affiliate_code", match),
    admin.from("orders").select("total_cents, refunded_cents, status, created_at").ilike("affiliate_code", match),
  ]);
  const sales: CreatorSale[] = [];
  for (const o of kits ?? []) {
    if (!countsForCommission("kit", o.status)) continue;
    const cents = netCents(o.total_cents, o.refunded_cents);
    if (cents <= 0) continue;
    const items = Array.isArray(o.items) ? (o.items as { product_name?: string; quantity?: number }[]) : [];
    const summary = items.map((i) => `${i.product_name ?? "Item"} ×${i.quantity ?? 1}`).join(", ") || "Kit order";
    const percent = rateAt(rates, o.created_at);
    sales.push({ date: o.created_at, type: "kit", cents, percent, commissionCents: commissionCents(cents, percent), summary });
  }
  for (const o of restorations ?? []) {
    if (!countsForCommission("restoration", o.status)) continue;
    const cents = netCents(o.total_cents, o.refunded_cents);
    if (cents <= 0) continue;
    const percent = rateAt(rates, o.created_at);
    sales.push({ date: o.created_at, type: "restoration", cents, percent, commissionCents: commissionCents(cents, percent), summary: "Restoration service" });
  }
  return sales.sort((a, b) => b.date.localeCompare(a.date));
}

export type CreatorTotals = { sales: number; cents: number; commissionCents: number };

function total(sales: CreatorSale[]): CreatorTotals {
  return {
    sales: sales.length,
    cents: sales.reduce((s, o) => s + o.cents, 0),
    // Each sale at its own rate, so a rate change doesn't reprice past sales
    commissionCents: sales.reduce((s, o) => s + o.commissionCents, 0),
  };
}

/** Totals overall, by type, for this month, and for each of the last `months` months. */
export function summarizeSales(sales: CreatorSale[], months = 6, now = new Date()) {
  const monthKey = (d: Date) => `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
  const byMonth: { key: string; label: string; totals: CreatorTotals }[] = [];
  for (let i = 0; i < months; i++) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1));
    const key = monthKey(d);
    byMonth.push({
      key,
      label: d.toLocaleDateString("en-US", { month: "short", year: "numeric", timeZone: "UTC" }),
      totals: total(sales.filter((s) => monthKey(new Date(s.date)) === key)),
    });
  }
  return {
    all: total(sales),
    restoration: total(sales.filter((s) => s.type === "restoration")),
    kit: total(sales.filter((s) => s.type === "kit")),
    thisMonth: byMonth[0].totals,
    byMonth,
  };
}
