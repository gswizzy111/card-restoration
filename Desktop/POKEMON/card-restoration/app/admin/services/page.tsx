import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import { addDays, etToday, formatDay, getServiceDays } from "@/lib/dashboard-metrics";
import { CsvButton } from "../csv-button";

export const dynamic = "force-dynamic";

const HISTORY_START = "2026-05-01";

const RANGES = [
  { key: "30", label: "30 Days" },
  { key: "90", label: "90 Days" },
  { key: "all", label: "All" },
] as const;

export default async function ServicesPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeParam)?.key ?? "30";

  const today = etToday();
  const from = range === "all" ? HISTORY_START : addDays(today, -(Number(range) - 1));
  const days = await getServiceDays(createAdminClient(), from, today);
  const rows = [...days].reverse();

  const sum = (k: keyof (typeof days)[number]) => days.reduce((s, d) => s + Number(d[k] ?? 0), 0);
  const totals = {
    prep_orders: sum("prep_orders"), prep_cards: sum("prep_cards"), prep_cents: sum("prep_cents"),
    restoration_orders: sum("restoration_orders"), restoration_cards: sum("restoration_cards"), restoration_cents: sum("restoration_cents"),
    unknown: sum("unknown_card_orders"),
  };
  const totalCents = totals.prep_cents + totals.restoration_cents;
  const share = (part: number, whole: number) => (whole > 0 ? `${Math.round((part / whole) * 100)}%` : "0%");
  const money = (c: number) => formatCurrency(c);

  const csv: (string | number)[][] = [
    ["Date", "PSA Prep orders", "PSA Prep cards", "PSA Prep revenue", "Full Restoration orders", "Full Restoration cards", "Full Restoration revenue", "Total revenue"],
    ...rows.map((d) => [
      d.day, d.prep_orders, d.prep_cards, (d.prep_cents / 100).toFixed(2),
      d.restoration_orders, d.restoration_cards, (d.restoration_cents / 100).toFixed(2),
      ((d.prep_cents + d.restoration_cents) / 100).toFixed(2),
    ]),
  ];

  const tiles = [
    { label: "PSA Prep", orders: totals.prep_orders, cards: totals.prep_cards, cents: totals.prep_cents, cls: "text-amber-700" },
    { label: "Full Restoration", orders: totals.restoration_orders, cards: totals.restoration_cards, cents: totals.restoration_cents, cls: "text-primary" },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <h1 className="font-heading font-black text-3xl text-foreground">PSA Prep vs Full Restoration</h1>
            <p className="text-muted-foreground text-sm mt-1">Paid orders by the day they were paid (New York time). Each order counts once, under its own service.</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex gap-1 bg-white border border-border rounded-lg p-1">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={`/admin/services?range=${r.key}`}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    range === r.key ? "bg-foreground text-background" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </Link>
              ))}
            </div>
            <CsvButton rows={csv} filename={`prep-vs-restoration-${range}-${today}.csv`} />
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {tiles.map((t) => (
            <div key={t.label} className="bg-white rounded-xl border border-border p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">{t.label}</p>
              <p className={`font-heading font-black text-3xl ${t.cls}`}>{money(t.cents)}</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {t.orders} order{t.orders !== 1 ? "s" : ""} · {t.cards} card{t.cards !== 1 ? "s" : ""} · {share(t.cents, totalCents)} of revenue
              </p>
            </div>
          ))}
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</p>
            <p className="font-heading font-black text-3xl text-foreground">{money(totalCents)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              {totals.prep_orders + totals.restoration_orders} orders · {totals.prep_cards + totals.restoration_cards} cards
            </p>
          </div>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/40 text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th rowSpan={2} className="px-4 py-2.5 text-left align-bottom whitespace-nowrap">Date</th>
                  <th colSpan={3} className="px-4 pt-2.5 pb-1 text-center border-l border-border text-amber-700">PSA Prep</th>
                  <th colSpan={3} className="px-4 pt-2.5 pb-1 text-center border-l border-border text-primary">Full Restoration</th>
                  <th rowSpan={2} className="px-4 py-2.5 text-right align-bottom border-l border-border whitespace-nowrap">Total Revenue</th>
                </tr>
                <tr className="bg-secondary/40 text-xs font-semibold text-muted-foreground">
                  <th className="px-4 pb-2.5 text-right border-l border-border">Orders</th>
                  <th className="px-4 pb-2.5 text-right">Cards</th>
                  <th className="px-4 pb-2.5 text-right">Revenue</th>
                  <th className="px-4 pb-2.5 text-right border-l border-border">Orders</th>
                  <th className="px-4 pb-2.5 text-right">Cards</th>
                  <th className="px-4 pb-2.5 text-right">Revenue</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border tabular-nums">
                <tr className="bg-secondary/20 font-bold text-foreground">
                  <td className="px-4 py-2.5 whitespace-nowrap">Total</td>
                  <td className="px-4 py-2.5 text-right border-l border-border">{totals.prep_orders}</td>
                  <td className="px-4 py-2.5 text-right">{totals.prep_cards}</td>
                  <td className="px-4 py-2.5 text-right">{money(totals.prep_cents)}</td>
                  <td className="px-4 py-2.5 text-right border-l border-border">{totals.restoration_orders}</td>
                  <td className="px-4 py-2.5 text-right">{totals.restoration_cards}</td>
                  <td className="px-4 py-2.5 text-right">{money(totals.restoration_cents)}</td>
                  <td className="px-4 py-2.5 text-right border-l border-border">{money(totalCents)}</td>
                </tr>
                {rows.map((d) => {
                  const empty = d.prep_orders + d.restoration_orders + d.prep_cents + d.restoration_cents === 0;
                  return (
                    <tr key={d.day} className={empty ? "text-muted-foreground" : "text-foreground"}>
                      <td className="px-4 py-2.5 whitespace-nowrap font-semibold">
                        {formatDay(d.day, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                        {d.day === today ? <span className="ml-2 text-xs font-bold text-emerald-700">so far</span> : null}
                      </td>
                      <td className="px-4 py-2.5 text-right border-l border-border">{d.prep_orders}</td>
                      <td className="px-4 py-2.5 text-right">{d.prep_cards}</td>
                      <td className="px-4 py-2.5 text-right">{money(d.prep_cents)}</td>
                      <td className="px-4 py-2.5 text-right border-l border-border">{d.restoration_orders}</td>
                      <td className="px-4 py-2.5 text-right">{d.restoration_cards}</td>
                      <td className="px-4 py-2.5 text-right">{money(d.restoration_cents)}</td>
                      <td className="px-4 py-2.5 text-right border-l border-border font-semibold">{money(d.prep_cents + d.restoration_cents)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-1.5">
          <p><strong className="text-foreground">How it&apos;s counted.</strong> PSA Prep orders are the ones placed through the prep checkout; every other paid order is Full Restoration (an order with cards in several tiers counts once). Revenue is what the order charged: services, tax, shipping, insurance and add-ons, after discounts and gift cards. Cards added to an order later, and tier upgrades, count on the day they were paid. Unpaid and abandoned checkouts aren&apos;t counted; refunds show on the dashboard on the day they were made. Kit orders aren&apos;t part of this breakdown.</p>
          {totals.unknown > 0 && (
            <p>{totals.unknown} manual order{totals.unknown !== 1 ? "s were" : " was"} entered with no cards or quantity, so {totals.unknown !== 1 ? "they add" : "it adds"} an order but no cards.</p>
          )}
        </div>
      </div>
    </div>
  );
}
