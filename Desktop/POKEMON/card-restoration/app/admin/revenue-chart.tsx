"use client";

import { useState, useMemo } from "react";
import { ComposedChart, Bar, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface Entry {
  cents: number;
  createdAt: string;
}

interface Bucket {
  label: string;
  revenue: number;
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

function buildBuckets(entries: Entry[], range: Range): Bucket[] {
  const now = new Date();

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
      return { label, revenue: items.reduce((s, e) => s + e.cents, 0) / 100, orders: items.length, trend: null };
    });
  }

  if (range === "7d") {
    const raw = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      const items = entries.filter((e) => {
        const od = new Date(e.createdAt);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && od.getDate() === d.getDate();
      });
      return {
        label: d.toLocaleString("default", { weekday: "short", month: "short", day: "numeric" }),
        revenue: items.reduce((s, e) => s + e.cents, 0) / 100,
        orders: items.length,
        trend: null as number | null,
      };
    });
    return raw;
  }

  if (range === "30d") {
    const raw = Array.from({ length: 30 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (29 - i));
      const items = entries.filter((e) => {
        const od = new Date(e.createdAt);
        return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth() && od.getDate() === d.getDate();
      });
      return {
        label: d.toLocaleString("default", { month: "short", day: "numeric" }),
        revenue: items.reduce((s, e) => s + e.cents, 0) / 100,
        orders: items.length,
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
  if (entries.length === 0) return [];
  const oldest = entries.reduce((min, e) => (e.createdAt < min ? e.createdAt : min), entries[0].createdAt);
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
    const label = new Date(year, month, 1).toLocaleString("default", { month: "short", year: "2-digit" });
    return { label, revenue: items.reduce((s, e) => s + e.cents, 0) / 100, orders: items.length, trend: null as number | null };
  });

  return raw.map((d, i) => {
    if (i < 2) return d;
    const window = raw.slice(i - 2, i + 1);
    const avg = window.reduce((s, x) => s + x.revenue, 0) / 3;
    return { ...d, trend: Math.round(avg * 100) / 100 };
  });
}

function CustomTooltip({ active, payload, label, range }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string; range: Range }) {
  if (!active || !payload?.length) return null;
  const revenue = payload.find((p) => p.name === "revenue");
  const orders = payload.find((p) => p.name === "orders");
  const trend = payload.find((p) => p.name === "trend");
  const avgLabel = range === "all" ? "3-mo avg" : range === "7d" ? "3-day avg" : "7-day avg";
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-md text-sm">
      <p className="font-bold text-foreground mb-1">{label}</p>
      {revenue && <p className="text-primary font-bold">${revenue.value.toFixed(2)}</p>}
      {orders && <p className="text-muted-foreground">{orders.value} order{orders.value !== 1 ? "s" : ""}</p>}
      {trend && trend.value != null && (
        <p className="text-orange-500 text-xs mt-1">{avgLabel}: ${trend.value.toFixed(2)}</p>
      )}
    </div>
  );
}

export function RevenueChart({ entries }: { entries: Entry[] }) {
  const [range, setRange] = useState<Range>("30d");

  const data = useMemo(() => buildBuckets(entries, range), [entries, range]);

  const showTrend = range !== "24h" && range !== "7d";
  const xInterval = range === "24h" ? 3 : range === "30d" ? 4 : 0;

  const titles: Record<Range, string> = {
    "24h": "Revenue — Last 24 Hours",
    "7d": "Revenue — Last 7 Days",
    "30d": "Revenue — Last 30 Days",
    all: "Revenue — All Time",
  };

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <h2 className="font-heading font-black text-lg text-foreground">{titles[range]}</h2>
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

      <ResponsiveContainer width="100%" height={260}>
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
            tick={{ fontSize: 12, fill: "#888" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip range={range} />} />
          <Bar dataKey="revenue" fill="oklch(0.55 0.22 265)" radius={[4, 4, 0, 0]} />
          <Bar dataKey="orders" fill="oklch(0.75 0.15 265)" radius={[4, 4, 0, 0]} />
          {showTrend && (
            <Line
              dataKey="trend"
              type="monotone"
              stroke="#f97316"
              strokeWidth={2}
              dot={false}
              connectNulls={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>

      <div className="flex gap-6 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />Revenue
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-sm inline-block" style={{ background: "oklch(0.75 0.15 265)" }} />Orders
        </div>
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
