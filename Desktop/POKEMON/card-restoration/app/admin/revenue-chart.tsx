"use client";

import { useState, useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, LabelList } from "recharts";
import type { RevenueSeries } from "@/lib/dashboard-metrics";

// Sales are dated when paid; refunds when the money went back (refund ledger).
// Every bucket is New York time, built on the server (lib/dashboard-metrics.ts).

interface Bucket {
  label: string;
  sales: number;     // dollars paid in this bucket
  refunded: number;  // dollars refunded in this bucket
  net: number;       // sales − refunded
  orders: number;
  trend: number | null;
}

type Range = "24h" | "7d" | "30d" | "all";

const RANGES: { key: Range; label: string }[] = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "all", label: "All Time" },
];

type Pick = { sales: number; orders: number; refunds: number };

function addDays(day: string, n: number) {
  const d = new Date(`${day}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + n);
  return d.toISOString().slice(0, 10);
}

function dayLabel(day: string, opts: Intl.DateTimeFormatOptions) {
  return new Date(`${day}T12:00:00Z`).toLocaleDateString("en-US", { ...opts, timeZone: "UTC" });
}

function bucket(label: string, p: Pick | undefined): Bucket {
  const sales = (p?.sales ?? 0) / 100;
  const refunded = (p?.refunds ?? 0) / 100;
  return { label, sales, refunded, net: Math.round((sales - refunded) * 100) / 100, orders: p?.orders ?? 0, trend: null };
}

function withTrend(raw: Bucket[], window: number): Bucket[] {
  return raw.map((d, i) => {
    if (i < window - 1) return d;
    const avg = raw.slice(i - window + 1, i + 1).reduce((s, x) => s + x.net, 0) / window;
    return { ...d, trend: Math.round(avg * 100) / 100 };
  });
}

function buildBuckets(series: RevenueSeries, range: Range, kitsOnly: boolean): Bucket[] {
  const daily = new Map(series.daily.map((d) => [d.day, kitsOnly
    ? { sales: d.kit_sales_cents, orders: d.kit_orders, refunds: d.kit_refund_cents }
    : { sales: d.sales_cents, orders: d.orders, refunds: d.refund_cents }]));

  if (range === "24h") {
    const hourly = new Map(series.hourly.map((h) => [h.hour.slice(0, 13), kitsOnly
      ? { sales: h.kit_sales_cents, orders: h.kit_orders, refunds: h.kit_refund_cents }
      : { sales: h.sales_cents, orders: h.orders, refunds: h.refund_cents }]));
    const end = new Date(`${series.now_hour.slice(0, 13)}:00:00Z`);
    return Array.from({ length: 24 }, (_, i) => {
      const t = new Date(end.getTime() - (23 - i) * 3_600_000);
      const key = t.toISOString().slice(0, 13);
      const h = t.getUTCHours();
      const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
      return bucket(label, hourly.get(key));
    });
  }

  if (range === "7d" || range === "30d") {
    const n = range === "7d" ? 7 : 30;
    const raw = Array.from({ length: n }, (_, i) => {
      const day = addDays(series.today, i - (n - 1));
      const label = range === "7d"
        ? dayLabel(day, { weekday: "short", month: "short", day: "numeric" })
        : dayLabel(day, { month: "short", day: "numeric" });
      return bucket(label, daily.get(day));
    });
    return range === "30d" ? withTrend(raw, 7) : raw;
  }

  // All time, by month
  const days = series.daily.filter((d) => kitsOnly ? d.kit_sales_cents || d.kit_orders || d.kit_refund_cents : true);
  if (days.length === 0) return [];
  const months = new Map<string, Pick>();
  for (const d of series.daily) {
    const m = d.day.slice(0, 7);
    const p = daily.get(d.day)!;
    const acc = months.get(m) ?? { sales: 0, orders: 0, refunds: 0 };
    months.set(m, { sales: acc.sales + p.sales, orders: acc.orders + p.orders, refunds: acc.refunds + p.refunds });
  }
  const first = days[0].day.slice(0, 7);
  const last = series.today.slice(0, 7);
  const raw: Bucket[] = [];
  for (let m = first; m <= last; ) {
    raw.push(bucket(dayLabel(`${m}-01`, { month: "short", year: "2-digit" }), months.get(m)));
    const [y, mo] = m.split("-").map(Number);
    m = mo === 12 ? `${y + 1}-01` : `${y}-${String(mo + 1).padStart(2, "0")}`;
  }
  return withTrend(raw, 3);
}

const money = (v: number) => `$${v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const shortMoney = (v: number) => (v >= 1000 ? `$${(v / 1000).toFixed(v >= 10_000 ? 0 : 1)}k` : `$${Math.round(v)}`);

function CustomTooltip({ active, payload, label, range }: {
  active?: boolean;
  payload?: { payload: Bucket }[];
  label?: string;
  range: Range;
}) {
  if (!active || !payload?.length) return null;
  const b = payload[0].payload;
  const avgLabel = range === "all" ? "3-mo avg" : "7-day avg";
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-md text-sm">
      <p className="font-bold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">{money(b.sales)} sales</p>
      {b.refunded > 0 && <p className="text-red-500 text-xs font-semibold">−{money(b.refunded)} refunded</p>}
      {b.refunded > 0 && <p className="text-foreground text-xs font-semibold">Net {money(b.net)}</p>}
      <p className="text-muted-foreground">{b.orders} order{b.orders !== 1 ? "s" : ""}</p>
      {b.trend != null && <p className="text-orange-500 text-xs mt-1">{avgLabel} (net): {money(b.trend)}</p>}
    </div>
  );
}

export function RevenueChart({
  series,
  label = "Revenue",
  kitsOnly = false,
}: {
  series: RevenueSeries;
  label?: string;
  kitsOnly?: boolean;
}) {
  const [range, setRange] = useState<Range>("30d");

  const data = useMemo(() => buildBuckets(series, range, kitsOnly), [series, range, kitsOnly]);

  const totalSales = data.reduce((s, d) => s + d.sales, 0);
  const totalRefunded = data.reduce((s, d) => s + d.refunded, 0);
  const totalOrders = data.reduce((s, d) => s + d.orders, 0);
  const hasRefunds = totalRefunded > 0;

  const showTrend = range === "30d" || range === "all";
  const xInterval = range === "24h" ? 3 : range === "30d" ? 4 : 0;

  const titles: Record<Range, string> = {
    "24h": "Last 24 Hours",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    all: "All Time",
  };

  const colCount = 2 + (hasRefunds ? 1 : 0);

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <h2 className="font-heading font-black text-lg text-foreground">{label} — {titles[range]}</h2>
        <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                range === r.key
                  ? "bg-white text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </div>

      {/* Summary tiles */}
      <div className="grid gap-3 mb-6" style={{ gridTemplateColumns: `repeat(${colCount}, minmax(0, 1fr))` }}>
        <div className="bg-secondary/40 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Net Revenue</p>
          <p className="font-heading font-black text-2xl text-primary">{money(totalSales - totalRefunded)}</p>
          {hasRefunds && <p className="text-xs text-muted-foreground mt-0.5">{money(totalSales)} sales</p>}
        </div>
        {hasRefunds && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Refunded</p>
            <p className="font-heading font-black text-2xl text-red-600">−{money(totalRefunded)}</p>
            <p className="text-xs text-red-400 mt-0.5">by the day the money went back</p>
          </div>
        )}
        <div className="bg-secondary/40 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Orders</p>
          <p className="font-heading font-black text-2xl text-foreground">{totalOrders}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} barGap={1} barSize={range === "24h" ? 6 : range === "7d" ? 22 : range === "all" && data.length <= 12 ? 22 : 8}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11, fill: "#888" }}
            axisLine={false}
            tickLine={false}
            interval={xInterval}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 12, fill: "#888" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip range={range} />} />
          <Bar dataKey="sales" yAxisId="left" fill="oklch(0.55 0.22 265)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="refunded" yAxisId="left" fill="#ef4444" radius={[4, 4, 0, 0]} fillOpacity={0.85}>
            {range === "7d" && (
              <LabelList dataKey="refunded" position="top" formatter={(v: unknown) => (Number(v) > 0 ? `−${shortMoney(Number(v))}` : "")} style={{ fontSize: 10, fill: "#dc2626", fontWeight: 700 }} />
            )}
          </Bar>
          <Bar dataKey="orders" yAxisId="left" fill="oklch(0.75 0.15 265)" radius={[4, 4, 0, 0]} />
          {showTrend && (
            <Line
              dataKey="trend"
              yAxisId="left"
              type="monotone"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex gap-6 mt-4 flex-wrap">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />Sales
        </div>
        {hasRefunds && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-3 h-3 rounded-sm inline-block bg-red-500 opacity-85" />Refunded that day
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "oklch(0.75 0.15 265)" }} />Orders
        </div>
        {showTrend && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-3 h-0.5 bg-orange-500 inline-block" />
            {range === "all" ? "3-mo avg (net)" : "7-day avg (net)"}
          </div>
        )}
      </div>
    </div>
  );
}
