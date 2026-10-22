"use client";

import { useState, useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Entry {
  cents: number;
  refundedCents?: number;
  createdAt: string;
}

// Each restoration order contributes one BacklogEntry
export interface BacklogEntry {
  cardCount: number;
  createdAt: string;       // when the order was created (proxy for "entered queue")
  completedAt?: string | null; // when it left the queue (null = still active)
}

interface Bucket {
  label: string;
  revenue: number;   // net (gross − refunded)
  refunded: number;
  orders: number;
  backlog: number;   // card backlog count as of this bucket's end
  trend: number | null;
}

type Range = "24h" | "7d" | "30d" | "all";

const RANGES: { key: Range; label: string }[] = [
  { key: "24h", label: "24 Hours" },
  { key: "7d", label: "7 Days" },
  { key: "30d", label: "30 Days" },
  { key: "all", label: "All Time" },
];

function computeBacklog(backlogEntries: BacklogEntry[], asOf: number): number {
  return backlogEntries.reduce((sum, e) => {
    const entered = new Date(e.createdAt).getTime();
    const left = e.completedAt ? new Date(e.completedAt).getTime() : Infinity;
    return sum + (entered <= asOf && left > asOf ? e.cardCount : 0);
  }, 0);
}

function buildBuckets(entries: Entry[], range: Range, backlogEntries: BacklogEntry[]): Bucket[] {
  const now = new Date();

  function bucketItems(items: Entry[]) {
    const grossCents = items.reduce((s, e) => s + e.cents, 0);
    const refundedCents = items.reduce((s, e) => s + (e.refundedCents ?? 0), 0);
    return {
      revenue: Math.max(0, grossCents - refundedCents) / 100,
      refunded: refundedCents / 100,
      orders: items.length,
    };
  }

  if (range === "24h") {
    return Array.from({ length: 24 }, (_, i) => {
      const hourStart = new Date(now);
      hourStart.setMinutes(0, 0, 0);
      hourStart.setHours(now.getHours() - (23 - i));
      const hourEnd = new Date(hourStart);
      hourEnd.setHours(hourStart.getHours() + 1);
      const items = entries.filter((e) => {
        const t = new Date(e.createdAt).getTime();
        return t >= hourStart.getTime() && t < hourEnd.getTime();
      });
      const h = hourStart.getHours();
      const label = h === 0 ? "12am" : h < 12 ? `${h}am` : h === 12 ? "12pm" : `${h - 12}pm`;
      return { label, ...bucketItems(items), backlog: computeBacklog(backlogEntries, hourEnd.getTime()), trend: null };
    });
  }

  if (range === "7d") {
    return Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const items = entries.filter((e) => {
        const od = new Date(e.createdAt);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && od.getDate() === d.getDate();
      });
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      return {
        label: d.toLocaleString("default", { weekday: "short", month: "short", day: "numeric" }),
        ...bucketItems(items),
        backlog: computeBacklog(backlogEntries, dayEnd),
        trend: null as number | null,
      };
    });
  }

  if (range === "30d") {
    const raw = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
      const items = entries.filter((e) => {
        const od = new Date(e.createdAt);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && od.getDate() === d.getDate();
      });
      const dayEnd = new Date(d.getFullYear(), d.getMonth(), d.getDate() + 1).getTime();
      return {
        label: d.toLocaleString("default", { month: "short", day: "numeric" }),
        ...bucketItems(items),
        backlog: computeBacklog(backlogEntries, dayEnd),
        trend: null as number | null,
      };
    });
    return raw.map((d, i) => {
      if (i < 6) return d;
      const window = raw.slice(i - 6, i + 1);
      const avg = window.reduce((s, x) => s + x.revenue, 0) / 7;
      return { ...d, trend: Math.round(avg * 100) / 100 };
    });
  }

  // all time — bucket by month
  if (entries.length === 0 && backlogEntries.length === 0) return [];
  const allDates = [
    ...entries.map((e) => e.createdAt),
    ...backlogEntries.map((e) => e.createdAt),
  ];
  if (allDates.length === 0) return [];
  const oldest = allDates.reduce((min, d) => (d < min ? d : min), allDates[0]);
  const startDate = new Date(oldest);
  const startYear = startDate.getFullYear();
  const startMonth = startDate.getMonth();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth();
  const totalMonths = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;

  const raw = Array.from({ length: totalMonths }, (_, i) => {
    const year = startYear + Math.floor((startMonth + i) / 12);
    const month = (startMonth + i) % 12;
    const items = entries.filter((e) => {
      const od = new Date(e.createdAt);
      return od.getFullYear() === year && od.getMonth() === month;
    });
    const monthEnd = new Date(year, month + 1, 1).getTime();
    const label = new Date(year, month, 1).toLocaleString("default", { month: "short", year: "2-digit" });
    return { label, ...bucketItems(items), backlog: computeBacklog(backlogEntries, monthEnd), trend: null as number | null };
  });

  return raw.map((d, i) => {
    if (i < 2) return d;
    const window = raw.slice(i - 2, i + 1);
    const avg = window.reduce((s, x) => s + x.revenue, 0) / 3;
    return { ...d, trend: Math.round(avg * 100) / 100 };
  });
}

function CustomTooltip({ active, payload, label, range, hasBacklog }: {
  active?: boolean;
  payload?: { name: string; value: number }[];
  label?: string;
  range: Range;
  hasBacklog: boolean;
}) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.name === "revenue");
  const refunded = payload.find((p) => p.name === "refunded");
  const orders = payload.find((p) => p.name === "orders");
  const trend = payload.find((p) => p.name === "trend");
  const backlog = payload.find((p) => p.name === "backlog");
  const avgLabel = range === "all" ? "3-mo avg" : range === "7d" ? "3-day avg" : "7-day avg";
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-md text-sm">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {revenue && <p className="text-primary font-bold">${revenue.value.toFixed(2)}</p>}
      {refunded && refunded.value > 0 && (
        <p className="text-red-500 text-xs font-semibold">−${refunded.value.toFixed(2)} refunded</p>
      )}
      {orders && <p className="text-muted-foreground">{orders.value} order{orders.value !== 1 ? "s" : ""}</p>}
      {hasBacklog && backlog != null && (
        <p className="text-teal-600 text-xs font-semibold mt-1">{backlog.value} card{backlog.value !== 1 ? "s" : ""} in backlog</p>
      )}
      {trend && trend.value != null && (
        <p className="text-orange-500 text-xs mt-1">{avgLabel}: ${trend.value.toFixed(2)}</p>
      )}
    </div>
  );
}

export function RevenueChart({
  entries,
  label = "Revenue",
  backlogEntries,
}: {
  entries: Entry[];
  label?: string;
  backlogEntries?: BacklogEntry[];
}) {
  const [range, setRange] = useState<Range>("30d");

  const bl = backlogEntries ?? [];
  const data = useMemo(() => buildBuckets(entries, range, bl), [entries, range, bl]);

  const totalRevenue = useMemo(() => data.reduce((s, d) => s + d.revenue, 0), [data]);
  const totalRefunded = useMemo(() => data.reduce((s, d) => s + d.refunded, 0), [data]);
  const totalOrders = useMemo(() => data.reduce((s, d) => s + d.orders, 0), [data]);
  const currentBacklog = useMemo(() => data[data.length - 1]?.backlog ?? 0, [data]);
  const hasRefunds = totalRefunded > 0;
  const hasBacklog = bl.length > 0;

  const showTrend = range !== "24h" && range !== "7d";
  const xInterval = range === "24h" ? 3 : range === "30d" ? 4 : 0;

  const titles: Record<Range, string> = {
    "24h": "Last 24 Hours",
    "7d": "Last 7 Days",
    "30d": "Last 30 Days",
    all: "All Time",
  };

  const colCount = 2 + (hasRefunds ? 1 : 0) + (hasBacklog ? 1 : 0);

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
      <div className={`grid gap-3 mb-6`} style={{ gridTemplateColumns: `repeat(${colCount}, 1fr)` }}>
        <div className="bg-secondary/40 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Net Revenue</p>
          <p className="font-heading font-black text-2xl text-primary">${totalRevenue.toFixed(2)}</p>
        </div>
        {hasRefunds && (
          <div className="bg-red-50 rounded-lg p-4 border border-red-100">
            <p className="text-xs font-bold uppercase tracking-widest text-red-400 mb-1">Refunded</p>
            <p className="font-heading font-black text-2xl text-red-600">−${totalRefunded.toFixed(2)}</p>
          </div>
        )}
        {hasBacklog && (
          <div className="bg-teal-50 rounded-lg p-4 border border-teal-100">
            <p className="text-xs font-bold uppercase tracking-widest text-teal-500 mb-1">Cards in Backlog</p>
            <p className="font-heading font-black text-2xl text-teal-700">{currentBacklog}</p>
          </div>
        )}
        <div className="bg-secondary/40 rounded-lg p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Orders</p>
          <p className="font-heading font-black text-2xl text-foreground">{totalOrders}</p>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={data} barSize={range === "24h" ? 8 : range === "7d" ? 28 : range === "all" && data.length <= 12 ? 28 : 10}>
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
          {hasBacklog && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "#0d9488" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v) => `${v}`}
              width={30}
            />
          )}
          <Tooltip content={<CustomTooltip range={range} hasBacklog={hasBacklog} />} />
          <Bar dataKey="revenue" yAxisId="left" fill="oklch(0.55 0.22 265)" stackId="rev" radius={[4, 4, 0, 0]} />
          <Bar dataKey="refunded" yAxisId="left" fill="#ef4444" stackId="rev" radius={[4, 4, 0, 0]} fillOpacity={0.85} />
          <Bar dataKey="orders" yAxisId="left" fill="oklch(0.75 0.15 265)" radius={[4, 4, 0, 0]} />
          {hasBacklog && (
            <Line
              dataKey="backlog"
              yAxisId="right"
              type="monotone"
              stroke="#0d9488"
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          )}
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
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />Revenue
        </div>
        {hasRefunds && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-3 h-3 rounded-sm inline-block bg-red-500 opacity-85" />Refunded
          </div>
        )}
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "oklch(0.75 0.15 265)" }} />Orders
        </div>
        {hasBacklog && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-3 h-0.5 inline-block" style={{ background: "#0d9488" }} />Card Backlog
          </div>
        )}
        {showTrend && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="w-3 h-0.5 bg-orange-500 inline-block" />
            {range === "all" ? "3-mo avg" : "7-day avg"}
          </div>
        )}
      </div>
    </div>
  );
}
