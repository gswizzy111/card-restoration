import { requireAdminOrAccountant } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { PrintButton } from "./print-button";

export const dynamic = "force-dynamic";

function fmt(cents: number | null | undefined) {
  const n = cents ?? 0;
  return `$${(n / 100).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function dateLabel(d: Date) {
  return d.toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" });
}

type Preset = "this_month" | "last_month" | "this_year" | "all";

function getRange(preset: Preset, from?: string, to?: string): { start: string | null; end: string | null; label: string } {
  const now = new Date();
  if (from && to) {
    return { start: new Date(from).toISOString(), end: new Date(to + "T23:59:59").toISOString(), label: `${from} – ${to}` };
  }
  switch (preset) {
    case "this_month": {
      const s = new Date(now.getFullYear(), now.getMonth(), 1);
      const e = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59);
      return { start: s.toISOString(), end: e.toISOString(), label: s.toLocaleString("en-US", { month: "long", year: "numeric" }) };
    }
    case "last_month": {
      const s = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const e = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59);
      return { start: s.toISOString(), end: e.toISOString(), label: s.toLocaleString("en-US", { month: "long", year: "numeric" }) };
    }
    case "this_year": {
      const s = new Date(now.getFullYear(), 0, 1);
      const e = new Date(now.getFullYear(), 11, 31, 23, 59, 59);
      return { start: s.toISOString(), end: e.toISOString(), label: `Year ${now.getFullYear()}` };
    }
    case "all":
      return { start: null, end: null, label: "All Time" };
  }
}

export default async function SalesStatementPage({
  searchParams,
}: {
  searchParams: Promise<{ preset?: string; from?: string; to?: string }>;
}) {
  await requireAdminOrAccountant();

  const sp = await searchParams;
  const preset = (["this_month", "last_month", "this_year", "all"].includes(sp.preset ?? "") ? sp.preset : "this_month") as Preset;
  const { start, end, label } = getRange(preset, sp.from, sp.to);

  const admin = createAdminClient();
  let q = admin
    .from("orders")
    .select("order_number, created_at, customer_name, customer_email, restoration_tier, subtotal_cents, discount_cents, shipping_cents, total_cents, refunded_cents, payment_status, status, affiliate_code, gift_card_discount_cents, loyalty_discount_percent")
    .not("status", "in", '("cancelled","awaiting_payment")')
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false });

  if (start) q = q.gte("created_at", start);
  if (end) q = q.lte("created_at", end);

  const { data: orders } = await q;
  const list = orders ?? [];

  // Totals
  const totalRevenue = list.reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const totalRefunds = list.reduce((s, o) => s + (o.refunded_cents ?? 0), 0);
  const netRevenue = totalRevenue - totalRefunds;
  const totalShipping = list.reduce((s, o) => s + (o.shipping_cents ?? 0), 0);
  const totalSubtotal = list.reduce((s, o) => s + (o.subtotal_cents ?? 0), 0);
  const totalDiscounts = list.reduce((s, o) => s + (o.discount_cents ?? 0) + (o.gift_card_discount_cents ?? 0), 0);
  // NJ tax: 6.625% on taxable (subtotal − discounts)
  const totalTax = list.reduce((s, o) => {
    const taxable = (o.subtotal_cents ?? 0) - (o.discount_cents ?? 0) - (o.gift_card_discount_cents ?? 0);
    return s + Math.round(Math.max(0, taxable) * 0.06625);
  }, 0);

  const csvParams = new URLSearchParams();
  if (start) csvParams.set("start", start);
  if (end) csvParams.set("end", end);
  const csvHref = `/api/admin/sales-statement?${csvParams}`;

  const presets: { value: Preset; label: string }[] = [
    { value: "this_month", label: "This Month" },
    { value: "last_month", label: "Last Month" },
    { value: "this_year", label: "This Year" },
    { value: "all", label: "All Time" },
  ];

  const TIER_LABELS: Record<string, string> = {
    basic: "Basic",
    standard: "Standard",
    premium: "Premium",
    elite: "Elite",
  };

  return (
    <>
      {/* Print styles */}
      <style>{`
        @media print {
          body * { visibility: hidden !important; }
          #statement-printable, #statement-printable * { visibility: visible !important; }
          #statement-printable { position: absolute; inset: 0; padding: 32px; }
          .no-print { display: none !important; }
          table { border-collapse: collapse; width: 100%; font-size: 11px; }
          th, td { border: 1px solid #ddd; padding: 4px 8px; text-align: left; }
          th { background: #f5f5f5; }
        }
      `}</style>

      <div className="min-h-screen bg-secondary/30">
        <div className="max-w-7xl mx-auto px-6 py-10">

          {/* Header */}
          <div className="flex items-start justify-between mb-6 no-print flex-wrap gap-4">
            <div>
              <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary transition-colors">← Admin</Link>
              <h1 className="font-heading font-black text-3xl text-foreground mt-1">Sales Statement</h1>
              <p className="text-muted-foreground text-sm mt-0.5">{list.length} paid order{list.length !== 1 ? "s" : ""} · {label}</p>
            </div>
            <div className="flex items-center gap-2">
              <a
                href={csvHref}
                className="h-9 px-4 border border-border bg-white rounded-lg text-sm font-semibold text-foreground hover:bg-secondary transition-colors flex items-center gap-2"
              >
                ⬇ CSV
              </a>
              <PrintButton />
            </div>
          </div>

          {/* Period filter */}
          <div className="flex flex-wrap gap-2 mb-6 no-print">
            {presets.map((p) => (
              <Link
                key={p.value}
                href={`/admin/sales-statement?preset=${p.value}`}
                className={`px-4 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  preset === p.value && !sp.from
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-white text-muted-foreground border-border hover:border-primary/40"
                }`}
              >
                {p.label}
              </Link>
            ))}

            {/* Custom date range */}
            <form method="GET" action="/admin/sales-statement" className="flex items-center gap-2">
              <input type="date" name="from" defaultValue={sp.from ?? ""} className="h-8 border border-border rounded-lg px-2 text-xs bg-white focus:outline-none focus:border-primary" />
              <span className="text-xs text-muted-foreground">to</span>
              <input type="date" name="to" defaultValue={sp.to ?? ""} className="h-8 border border-border rounded-lg px-2 text-xs bg-white focus:outline-none focus:border-primary" />
              <button type="submit" className="h-8 px-3 bg-secondary rounded-lg text-xs font-semibold text-foreground hover:bg-secondary/80 transition-colors">Go</button>
            </form>
          </div>

          <div id="statement-printable">
            {/* Print header */}
            <div className="hidden print:block mb-6">
              <p className="text-2xl font-black">The Card Doc — Sales Statement</p>
              <p className="text-sm text-gray-500">{label} · Generated {new Date().toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}</p>
            </div>

            {/* Summary cards */}
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-6">
              {[
                { label: "Gross Revenue", value: fmt(totalRevenue), color: "text-green-700" },
                { label: "Refunds", value: fmt(totalRefunds), color: "text-red-600" },
                { label: "Net Revenue", value: fmt(netRevenue), color: "text-foreground font-black" },
                { label: "Est. Tax Collected", value: fmt(totalTax), color: "text-blue-700" },
                { label: "Total Discounts", value: fmt(totalDiscounts), color: "text-orange-600" },
              ].map((s) => (
                <div key={s.label} className="bg-white rounded-xl border border-border p-4">
                  <p className="text-xs text-muted-foreground mb-1">{s.label}</p>
                  <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
                </div>
              ))}
            </div>

            {/* Orders table */}
            {list.length === 0 ? (
              <div className="bg-white rounded-xl border border-border p-16 text-center">
                <p className="font-heading font-black text-lg">No paid orders in this period</p>
              </div>
            ) : (
              <div className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-secondary/30">
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Date</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Order #</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Customer</th>
                        <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Tier</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Subtotal</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Discount</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Shipping</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Tax</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Total</th>
                        <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Refunded</th>
                      </tr>
                    </thead>
                    <tbody>
                      {list.map((o, i) => {
                        const discountTotal = (o.discount_cents ?? 0) + (o.gift_card_discount_cents ?? 0);
                        const taxable = (o.subtotal_cents ?? 0) - discountTotal;
                        const tax = Math.round(Math.max(0, taxable) * 0.06625);
                        return (
                          <tr key={o.order_number ?? i} className={`border-b border-border last:border-0 hover:bg-secondary/20 transition-colors ${(o.refunded_cents ?? 0) > 0 ? "bg-red-50/40" : ""}`}>
                            <td className="px-4 py-3 text-muted-foreground text-xs whitespace-nowrap">
                              {dateLabel(new Date(o.created_at))}
                            </td>
                            <td className="px-4 py-3">
                              <Link href={`/admin/orders/${o.order_number}`} className="font-mono text-xs font-bold text-primary hover:underline no-print">
                                #{o.order_number}
                              </Link>
                              <span className="font-mono text-xs font-bold hidden print:inline">#{o.order_number}</span>
                            </td>
                            <td className="px-4 py-3">
                              <p className="font-medium text-foreground text-xs">{o.customer_name}</p>
                              <p className="text-muted-foreground text-[11px]">{o.customer_email}</p>
                            </td>
                            <td className="px-4 py-3">
                              <span className="text-xs text-muted-foreground">
                                {o.restoration_tier ? (TIER_LABELS[o.restoration_tier] ?? o.restoration_tier) : "—"}
                              </span>
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-mono">{fmt(o.subtotal_cents)}</td>
                            <td className="px-4 py-3 text-right text-xs font-mono text-orange-600">
                              {discountTotal > 0 ? `-${fmt(discountTotal)}` : "—"}
                            </td>
                            <td className="px-4 py-3 text-right text-xs font-mono">{fmt(o.shipping_cents)}</td>
                            <td className="px-4 py-3 text-right text-xs font-mono text-blue-600">{fmt(tax)}</td>
                            <td className="px-4 py-3 text-right text-xs font-mono font-bold">{fmt(o.total_cents)}</td>
                            <td className="px-4 py-3 text-right text-xs font-mono text-red-600">
                              {(o.refunded_cents ?? 0) > 0 ? `-${fmt(o.refunded_cents)}` : "—"}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot>
                      <tr className="border-t-2 border-border bg-secondary/30">
                        <td colSpan={4} className="px-4 py-3 text-xs font-black uppercase tracking-widest text-foreground">Totals ({list.length} orders)</td>
                        <td className="px-4 py-3 text-right text-xs font-mono font-black">{fmt(totalSubtotal)}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono font-black text-orange-600">{totalDiscounts > 0 ? `-${fmt(totalDiscounts)}` : "—"}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono font-black">{fmt(totalShipping)}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono font-black text-blue-600">{fmt(totalTax)}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono font-black">{fmt(totalRevenue)}</td>
                        <td className="px-4 py-3 text-right text-xs font-mono font-black text-red-600">{totalRefunds > 0 ? `-${fmt(totalRefunds)}` : "—"}</td>
                      </tr>
                      <tr className="bg-green-50">
                        <td colSpan={8} className="px-4 py-3 text-xs font-black text-green-900">Net Revenue (after refunds)</td>
                        <td colSpan={2} className="px-4 py-3 text-right text-sm font-black text-green-800">{fmt(netRevenue)}</td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              </div>
            )}

            {/* Footer note */}
            <p className="text-xs text-muted-foreground mt-4 text-center">
              Tax estimates use NJ rate (6.625%) on taxable revenue. For official tax purposes, consult your accountant.
            </p>
          </div>
        </div>
      </div>
    </>
  );
}
