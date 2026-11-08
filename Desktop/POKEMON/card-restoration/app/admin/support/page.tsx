import Link from "next/link";
import { createAdminClient } from "@/lib/supabase/admin";
import { requireAdminOrSupport } from "@/lib/admin-auth";
import { likeExact } from "@/lib/like-exact";
import { INQUIRY_TYPE, OPEN_CASE_STATUSES, orderLabel } from "@/lib/card-inquiries";
import { PROBLEM_TYPE } from "@/lib/problem-reports";
import { openProblemCount } from "@/lib/email-problems";
import { ViewAsButton } from "@/app/admin/view-as-button";
import { cleanSearch, etDate, orderNumberFrom, statusLabel, tierLabel } from "@/lib/support-view";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  awaiting_payment: "bg-gray-100 text-gray-600",
  awaiting_cards: "bg-amber-100 text-amber-700",
  received: "bg-blue-100 text-blue-700",
  in_progress: "bg-purple-100 text-purple-700",
  completed: "bg-green-100 text-green-700",
  shipped_back: "bg-cyan-100 text-cyan-700",
  delivered: "bg-emerald-100 text-emerald-700",
  cancelled: "bg-red-100 text-red-700",
};

// Columns support staff may see on a search result: no totals or payments
const ORDER_COLUMNS = "id, order_number, customer_name, customer_email, status, restoration_tier, created_at";
const LIMIT = 50;

type OrderRow = { id: string; order_number: string; customer_name: string | null; customer_email: string | null; status: string; restoration_tier: string | null; created_at: string };
type KitRow = { id: string; order_number: number; customer_name: string | null; customer_email: string | null; status: string; tracking_number: string | null; carrier: string | null; created_at: string; shipped_at: string | null };

/**
 * Customer support home: look an order up by order number, customer name,
 * email or card name, and see what's waiting for a reply. Admins can open it
 * too, to see what their support team sees.
 */
export default async function SupportHomePage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const role = await requireAdminOrSupport();
  const query = cleanSearch((await searchParams).q);
  const admin = createAdminClient();

  const [{ count: updateRequests }, { count: openCases }, emailProblems] = await Promise.all([
    admin.from("cases").select("id", { count: "exact", head: true }).eq("type", INQUIRY_TYPE).in("status", OPEN_CASE_STATUSES),
    admin.from("cases").select("id", { count: "exact", head: true }).in("type", ["support", PROBLEM_TYPE]).in("status", OPEN_CASE_STATUSES),
    openProblemCount(),
  ]);

  let orders: OrderRow[] = [];
  let kits: KitRow[] = [];
  if (query) {
    const n = orderNumberFrom(query);
    const pattern = `%${likeExact(query)}%`;
    const KIT_COLUMNS = "id, order_number, customer_name, customer_email, status, tracking_number, carrier, created_at, shipped_at";
    const [byNumber, byName, byEmail, byCard, kitByNumber, kitByName, kitByEmail] = await Promise.all([
      n.restoration ? admin.from("orders").select(ORDER_COLUMNS).eq("order_number", n.restoration) : { data: [] },
      admin.from("orders").select(ORDER_COLUMNS).ilike("customer_name", pattern).order("created_at", { ascending: false }).limit(LIMIT),
      admin.from("orders").select(ORDER_COLUMNS).ilike("customer_email", pattern).order("created_at", { ascending: false }).limit(LIMIT),
      admin.from("cards").select("order_id").ilike("card_name", pattern).limit(LIMIT),
      n.kit ? admin.from("shop_orders").select(KIT_COLUMNS).eq("order_number", n.kit) : { data: [] },
      admin.from("shop_orders").select(KIT_COLUMNS).ilike("customer_name", pattern).order("created_at", { ascending: false }).limit(LIMIT),
      admin.from("shop_orders").select(KIT_COLUMNS).ilike("customer_email", pattern).order("created_at", { ascending: false }).limit(LIMIT),
    ]);
    const cardOrderIds = [...new Set((byCard.data ?? []).map((c) => c.order_id as string))];
    const { data: byCardOrders } = cardOrderIds.length
      ? await admin.from("orders").select(ORDER_COLUMNS).in("id", cardOrderIds)
      : { data: [] };

    const unique = <T extends { id: string; created_at: string }>(rows: T[]) =>
      [...new Map(rows.map((r) => [r.id, r])).values()].sort((a, b) => b.created_at.localeCompare(a.created_at));
    // An exact order number goes first
    const exact = (byNumber.data ?? []) as OrderRow[];
    orders = unique([...exact, ...((byName.data ?? []) as OrderRow[]), ...((byEmail.data ?? []) as OrderRow[]), ...((byCardOrders ?? []) as OrderRow[])]);
    orders = [...exact, ...orders.filter((o) => !exact.some((e) => e.id === o.id))]
      // Checkouts that were never paid for aren't customer orders yet
      .filter((o) => o.status !== "awaiting_payment")
      .slice(0, LIMIT);
    kits = unique([...((kitByNumber.data ?? []) as KitRow[]), ...((kitByName.data ?? []) as KitRow[]), ...((kitByEmail.data ?? []) as KitRow[])]).slice(0, LIMIT);
  }

  const tile = (href: string, label: string, count: number, hint: string) => (
    <Link href={href} className="bg-white rounded-xl border border-border p-4 hover:border-primary/40 transition-colors flex flex-col gap-1">
      <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{label}</span>
      <span className={`font-heading font-black text-2xl ${count > 0 ? "text-red-600" : "text-foreground"}`}>{count}</span>
      <span className="text-xs text-muted-foreground">{hint}</span>
    </Link>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-6">
          <h1 className="font-heading font-black text-3xl text-foreground">Customer Support</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Look up an order to answer a customer.
          </p>
          {role === "admin" && (
            <ViewAsButton to="support" className="mt-3 h-9 px-4 rounded-lg bg-gray-900 text-white text-sm font-bold disabled:opacity-60">
              👀 View as Support
            </ViewAsButton>
          )}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
          {tile("/admin/cases?filter=open&type=inquiry", "Update Requests", updateRequests ?? 0, "Customers asking where their card is")}
          {tile("/admin/cases?filter=open&type=all", "Open Cases", openCases ?? 0, "Support cases and problem reports")}
          {tile("/admin/email-problems", "Email Problems", emailProblems, "Addresses our emails aren't reaching")}
        </div>

        <form method="GET" action="/admin/support" className="flex gap-2 mb-6">
          <label htmlFor="q" className="sr-only">Search orders</label>
          <input
            id="q"
            name="q"
            defaultValue={query}
            placeholder="Order number (CD-2082 or K566), customer name, email or card name"
            className="flex-1 min-w-0 h-11 px-4 rounded-lg border border-border bg-white text-sm outline-none focus:border-primary transition-colors"
            autoFocus
          />
          <button type="submit" className="h-11 px-5 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors">
            Search
          </button>
        </form>

        {query && (
          <>
            <h2 className="font-heading font-black text-lg text-foreground mb-3">
              Restoration &amp; prep orders <span className="text-muted-foreground font-medium text-sm">({orders.length}{orders.length === LIMIT ? "+" : ""})</span>
            </h2>
            {orders.length === 0 ? (
              <p className="bg-white rounded-xl border border-border p-6 text-sm text-muted-foreground mb-8">No orders match &ldquo;{query}&rdquo;.</p>
            ) : (
              <div className="bg-white rounded-xl border border-border divide-y divide-border mb-8">
                {orders.map((o) => (
                  <Link key={o.id} href={`/admin/support/orders/${o.id}`} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5 hover:bg-secondary/40 transition-colors">
                    <span className="font-heading font-black text-foreground w-20">{orderLabel(o.order_number)}</span>
                    <span className="flex-1 min-w-[10rem]">
                      <span className="block text-sm font-semibold text-foreground truncate">{o.customer_name ?? "—"}</span>
                      <span className="block text-xs text-muted-foreground truncate">{o.customer_email}</span>
                    </span>
                    <span className="text-xs font-semibold text-muted-foreground">{tierLabel(o.restoration_tier)}</span>
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[o.status] ?? "bg-gray-100 text-gray-600"}`}>{statusLabel(o.status)}</span>
                    <span className="text-xs text-muted-foreground w-24 text-right">{etDate(o.created_at)}</span>
                  </Link>
                ))}
              </div>
            )}

            {kits.length > 0 && (
              <>
                <h2 className="font-heading font-black text-lg text-foreground mb-3">Kit orders <span className="text-muted-foreground font-medium text-sm">({kits.length})</span></h2>
                <div className="bg-white rounded-xl border border-border divide-y divide-border">
                  {kits.map((k) => (
                    <div key={k.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-5 py-3.5">
                      <span className="font-heading font-black text-foreground w-20">K{k.order_number}</span>
                      <span className="flex-1 min-w-[10rem]">
                        <span className="block text-sm font-semibold text-foreground truncate">{k.customer_name ?? "—"}</span>
                        <span className="block text-xs text-muted-foreground truncate">{k.customer_email}</span>
                      </span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 capitalize">{k.status}</span>
                      <span className="text-xs text-muted-foreground">
                        {k.tracking_number ? `${k.carrier ?? "Tracking"} ${k.tracking_number}` : "Not shipped yet"}
                        {k.shipped_at ? ` · shipped ${etDate(k.shipped_at)}` : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {!query && (
          <div className="bg-white rounded-xl border border-border p-6 text-sm text-muted-foreground leading-relaxed">
            <p className="font-semibold text-foreground mb-2">Answering a customer</p>
            <ol className="list-decimal pl-5 flex flex-col gap-1">
              <li>Search for their order above (order number is fastest; their email works too).</li>
              <li>Check the status, each card&apos;s stage and the tracking before you reply.</li>
              <li>Reply from the case or update request so the answer is emailed and saved with your name.</li>
              <li>Anything about money, refunds, changing an order or a damaged card: add a note and pass it to an admin.</li>
            </ol>
          </div>
        )}
      </div>
    </div>
  );
}
