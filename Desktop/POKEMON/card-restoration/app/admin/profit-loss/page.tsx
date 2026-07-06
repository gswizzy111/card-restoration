import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getProductCosts } from "@/lib/product-costs";
import { formatCurrency } from "@/lib/utils";
import { PeriodTabs } from "./period-tabs";
import { CostSettings } from "./cost-settings";
import Link from "next/link";

export const dynamic = "force-dynamic";

type Period = "today" | "week" | "month" | "all";

function periodStart(period: Period): string | null {
  const now = new Date();
  switch (period) {
    case "today": return new Date(now.getFullYear(), now.getMonth(), now.getDate()).toISOString();
    case "week":  return new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    case "month": return new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    case "all":   return null;
  }
}

export default async function ProfitLossPage({ searchParams }: { searchParams: Promise<{ period?: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const sp = await searchParams;
  const period = (["today", "week", "month", "all"].includes(sp.period ?? "") ? sp.period : "month") as Period;
  const start = periodStart(period);

  const admin = createAdminClient();

  // Fetch data in parallel
  const [shopResult, orderResult, productResult, costConfig] = await Promise.all([
    (() => {
      let q = admin.from("shop_orders").select("total_cents, subtotal_cents, shipping_cents, items, created_at").neq("status", "cancelled");
      if (start) q = q.gte("created_at", start);
      return q;
    })(),
    (() => {
      let q = admin.from("orders").select("total_cents, restoration_tier, created_at").not("status", "in", '("cancelled","awaiting_payment")');
      if (start) q = q.gte("created_at", start);
      return q;
    })(),
    admin.from("products").select("id, name, price_cents"),
    getProductCosts(),
  ]);

  const shopOrders = shopResult.data ?? [];
  const restorationOrders = orderResult.data ?? [];
  const products = productResult.data ?? [];
  const productMap = new Map(products.map((p) => [p.id, p.name]));

  // ── Kit Sales ────────────────────────────────────────
  type ProductStat = { name: string; units: number; revenue_cents: number; cogs_cents: number };
  const productStats: Record<string, ProductStat> = {};
  let kitRevenue = 0;
  let kitShipping = 0;
  let taxCollected = 0;
  let kitCogs = 0;

  for (const order of shopOrders) {
    kitRevenue += order.total_cents ?? 0;
    kitShipping += order.shipping_cents ?? 0;
    const tax = Math.max(0, (order.total_cents ?? 0) - (order.subtotal_cents ?? 0) - (order.shipping_cents ?? 0));
    taxCollected += tax;

    const items: Array<{ product_id?: string; product_name?: string; quantity?: number; price_cents?: number }> =
      Array.isArray(order.items) ? order.items : [];

    for (const item of items) {
      const pid = item.product_id ?? "";
      const qty = item.quantity ?? 1;
      const itemRevenue = (item.price_cents ?? 0) * qty;
      const itemCogs = (costConfig.products[pid]?.cost_cents ?? 0) * qty;
      kitCogs += itemCogs;

      if (!productStats[pid]) {
        productStats[pid] = { name: item.product_name ?? productMap.get(pid) ?? pid, units: 0, revenue_cents: 0, cogs_cents: 0 };
      }
      productStats[pid].units += qty;
      productStats[pid].revenue_cents += itemRevenue;
      productStats[pid].cogs_cents += itemCogs;
    }
  }

  // ── Restoration ──────────────────────────────────────
  type TierStat = { label: string; orders: number; revenue_cents: number; cogs_cents: number };
  const tierStats: Record<string, TierStat> = {};
  let restRevenue = 0;
  let restCogs = 0;

  const TIER_LABELS: Record<string, string> = { regular: "Regular", expedited: "Expedited", premium: "Premium", ultra_premium: "Ultra Premium" };

  for (const order of restorationOrders) {
    const tier = order.restoration_tier ?? "regular";
    const revenue = order.total_cents ?? 0;
    const costKey = `${tier}_cents` as keyof typeof costConfig.restoration;
    const cogs = costConfig.restoration[costKey] ?? 0;

    restRevenue += revenue;
    restCogs += cogs;

    if (!tierStats[tier]) tierStats[tier] = { label: TIER_LABELS[tier] ?? tier, orders: 0, revenue_cents: 0, cogs_cents: 0 };
    tierStats[tier].orders += 1;
    tierStats[tier].revenue_cents += revenue;
    tierStats[tier].cogs_cents += cogs;
  }

  // ── Totals ───────────────────────────────────────────
  const totalRevenue = kitRevenue + restRevenue;
  const totalCogs = kitCogs + restCogs;
  const netProfit = totalRevenue - totalCogs - taxCollected;
  const margin = totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0;
  const hasCosts = Object.values(costConfig.products).some((p) => p.cost_cents > 0) ||
    Object.values(costConfig.restoration).some((v) => v > 0);

  return (
    <div className="p-6 max-w-5xl mx-auto flex flex-col gap-6">
      <div className="flex items-start justify-between flex-wrap gap-4">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Profit &amp; Loss</h1>
          <p className="text-muted-foreground text-sm mt-0.5">Revenue, costs, and net profit across your business</p>
        </div>
        <PeriodTabs current={period} />
      </div>

      {!hasCosts && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900">
          <strong>Set your costs to see real profit numbers.</strong> Go to each{" "}
          <Link href="/admin/products" className="underline font-semibold">product page</Link>{" "}
          to add component costs, and fill in restoration supply costs below.
        </div>
      )}

      {/* Summary */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard label="Gross Revenue" value={formatCurrency(totalRevenue)} color="green" />
        <StatCard label="Cost of Goods" value={formatCurrency(totalCogs)} color="red" />
        <StatCard label="Tax Owed (NJ)" value={formatCurrency(taxCollected)} color="orange" />
        <StatCard label="Net Profit" value={formatCurrency(netProfit)} color={netProfit >= 0 ? "blue" : "red"} />
        <StatCard label="Profit Margin" value={`${margin}%`} color={margin >= 20 ? "purple" : margin >= 0 ? "blue" : "red"} />
      </div>

      {/* Breakdown cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-heading font-black text-sm uppercase tracking-wide text-muted-foreground mb-4">Revenue Breakdown</h3>
          <div className="flex flex-col gap-2.5 text-sm">
            <Row label="Kit Sales" value={formatCurrency(kitRevenue)} />
            <Row label="  Shipping collected" value={formatCurrency(kitShipping)} muted />
            <Row label="  Tax collected" value={formatCurrency(taxCollected)} muted />
            <Row label="Restoration Services" value={formatCurrency(restRevenue)} />
            <div className="border-t border-border pt-2.5 mt-1">
              <Row label="Total Revenue" value={formatCurrency(totalRevenue)} bold />
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl border border-border p-5">
          <h3 className="font-heading font-black text-sm uppercase tracking-wide text-muted-foreground mb-4">Cost Breakdown</h3>
          <div className="flex flex-col gap-2.5 text-sm">
            <Row label="Kit product costs (COGS)" value={formatCurrency(kitCogs)} />
            <Row label="Restoration supply costs" value={formatCurrency(restCogs)} />
            <Row label="Sales tax owed to NJ" value={formatCurrency(taxCollected)} />
            <div className="border-t border-border pt-2.5 mt-1">
              <Row label="Total Costs" value={formatCurrency(totalCogs + taxCollected)} bold />
            </div>
          </div>
        </div>
      </div>

      {/* Kit sales per product */}
      {Object.keys(productStats).length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border flex items-center justify-between">
            <h2 className="font-heading font-black text-lg">Kit Sales by Product</h2>
            <Link href="/admin/products" className="text-xs text-primary hover:underline">Edit product costs →</Link>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Product</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Units</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">COGS</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(productStats).map((s) => {
                  const profit = s.revenue_cents - s.cogs_cents;
                  return (
                    <tr key={s.name} className="hover:bg-muted/20">
                      <td className="px-6 py-3 font-medium">{s.name}</td>
                      <td className="px-4 py-3 text-right">{s.units}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(s.revenue_cents)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{s.cogs_cents > 0 ? formatCurrency(s.cogs_cents) : <span className="text-muted-foreground text-xs italic">not set</span>}</td>
                      <td className={`px-6 py-3 text-right font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {s.cogs_cents > 0 ? formatCurrency(profit) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Restoration by tier */}
      {Object.keys(tierStats).length > 0 && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-heading font-black text-lg">Restoration Services by Tier</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="text-left px-6 py-3 font-medium text-muted-foreground">Tier</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Orders</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Revenue</th>
                  <th className="text-right px-4 py-3 font-medium text-muted-foreground">Est. COGS</th>
                  <th className="text-right px-6 py-3 font-medium text-muted-foreground">Profit</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {Object.values(tierStats).map((t) => {
                  const profit = t.revenue_cents - t.cogs_cents;
                  return (
                    <tr key={t.label} className="hover:bg-muted/20">
                      <td className="px-6 py-3 font-medium">{t.label}</td>
                      <td className="px-4 py-3 text-right">{t.orders}</td>
                      <td className="px-4 py-3 text-right">{formatCurrency(t.revenue_cents)}</td>
                      <td className="px-4 py-3 text-right text-red-600">{t.cogs_cents > 0 ? formatCurrency(t.cogs_cents) : <span className="text-muted-foreground text-xs italic">not set</span>}</td>
                      <td className={`px-6 py-3 text-right font-bold ${profit >= 0 ? "text-green-600" : "text-red-600"}`}>
                        {t.cogs_cents > 0 ? formatCurrency(profit) : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {shopOrders.length === 0 && restorationOrders.length === 0 && (
        <div className="bg-muted/30 rounded-xl p-12 text-center text-muted-foreground">
          No completed orders in this period.
        </div>
      )}

      {/* Cost Settings */}
      <CostSettings initial={costConfig} />
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  const colors: Record<string, string> = {
    green: "bg-green-50 border-green-200 text-green-800",
    red: "bg-red-50 border-red-200 text-red-800",
    orange: "bg-orange-50 border-orange-200 text-orange-800",
    blue: "bg-blue-50 border-blue-200 text-blue-800",
    purple: "bg-purple-50 border-purple-200 text-purple-800",
  };
  return (
    <div className={`rounded-xl border p-4 ${colors[color] ?? colors.blue}`}>
      <p className="text-xs font-bold uppercase tracking-wide opacity-60 mb-1">{label}</p>
      <p className="font-heading font-black text-2xl">{value}</p>
    </div>
  );
}

function Row({ label, value, bold, muted }: { label: string; value: string; bold?: boolean; muted?: boolean }) {
  return (
    <div className={`flex justify-between gap-4 ${muted ? "text-muted-foreground pl-3" : ""} ${bold ? "font-bold" : ""}`}>
      <span>{label}</span>
      <span className="tabular-nums">{value}</span>
    </div>
  );
}
