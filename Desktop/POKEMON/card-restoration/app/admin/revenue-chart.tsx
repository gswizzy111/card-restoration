"use client";

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";

interface MonthData {
  month: string;
  revenue: number;
  orders: number;
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: { value: number }[]; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-md text-sm">
      <p className="font-bold text-foreground mb-1">{label}</p>
      <p className="text-primary font-bold">${(payload[0].value).toFixed(2)}</p>
      <p className="text-muted-foreground">{payload[1]?.value} orders</p>
    </div>
  );
}

export function RevenueChart({ data }: { data: MonthData[] }) {
  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-6">Revenue by Month</h2>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} barSize={32}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="month" tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} />
          <YAxis
            tick={{ fontSize: 12, fill: "#888" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v) => `$${v}`}
          />
          <Tooltip content={<CustomTooltip />} />
          <Bar dataKey="revenue" fill="oklch(0.46 0.22 25)" radius={[6, 6, 0, 0]} />
          <Bar dataKey="orders" fill="oklch(0.87 0.17 88)" radius={[6, 6, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-6 mt-4">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-primary inline-block" />Revenue
        </div>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <span className="w-3 h-3 rounded-sm bg-accent inline-block" />Orders
        </div>
      </div>
    </div>
  );
}
