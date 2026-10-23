"use client";

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { QUALITY_LABEL, backlogKnown, backlogNotes, formatDay, type BacklogDay } from "@/lib/dashboard-metrics";

// End-of-day card backlog, one point per New York calendar day. Days without
// enough history are gaps, never zero.

type Point = { label: string; total: number | null; row: BacklogDay };

function BacklogTooltip({ active, payload }: { active?: boolean; payload?: { payload: Point }[] }) {
  if (!active || !payload?.length) return null;
  const { row } = payload[0].payload;
  const notes = backlogNotes(row);
  return (
    <div className="bg-white border border-border rounded-lg p-3 shadow-md text-sm max-w-64">
      <p className="font-bold text-foreground mb-1">
        {formatDay(row.day, { weekday: "short", month: "short", day: "numeric" })}
        {row.quality === "live" ? " (so far)" : ""}
      </p>
      {backlogKnown(row) ? (
        <>
          <p className="text-teal-700 font-bold">{row.total} unfinished card{row.total !== 1 ? "s" : ""}</p>
          <p className="text-xs text-muted-foreground">+{row.added} added · −{row.completed} completed</p>
        </>
      ) : null}
      {row.quality !== "live" && row.quality !== "recorded" && (
        <p className="text-xs font-semibold text-foreground mt-1">{QUALITY_LABEL[row.quality]}</p>
      )}
      {notes.map((n) => (
        <p key={n} className="text-xs text-muted-foreground mt-0.5">{n}</p>
      ))}
    </div>
  );
}

export function BacklogChart({ days, title = "Card Backlog — Last 30 Days" }: { days: BacklogDay[]; title?: string }) {
  const data: Point[] = days.map((row) => ({
    label: formatDay(row.day),
    total: backlogKnown(row) ? row.total : null,
    row,
  }));
  const today = days[days.length - 1];
  const known = days.filter(backlogKnown);
  const first = known[0];
  const change = today && first && today !== first ? today.total - first.total : null;

  return (
    <div className="bg-white rounded-xl border border-border p-6">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-3 mb-5">
        <div>
          <h2 className="font-heading font-black text-lg text-foreground">{title}</h2>
          <p className="text-xs text-muted-foreground mt-0.5">Unfinished cards at the end of each day (New York time)</p>
        </div>
        {today && (
          <div className="text-right">
            <p className="font-heading font-black text-2xl text-teal-700">{today.total}</p>
            {change != null && (
              <p className="text-xs text-muted-foreground">
                {change === 0 ? "no change" : `${change > 0 ? "+" : "−"}${Math.abs(change)}`} since {formatDay(first.day)}
              </p>
            )}
          </div>
        )}
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
          <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#888" }} axisLine={false} tickLine={false} interval={4} />
          <YAxis tick={{ fontSize: 12, fill: "#888" }} axisLine={false} tickLine={false} allowDecimals={false} domain={["auto", "auto"]} />
          <Tooltip content={<BacklogTooltip />} />
          <Line
            dataKey="total"
            type="monotone"
            stroke="#0d9488"
            strokeWidth={2}
            dot={{ r: 2.5, fill: "#0d9488", strokeWidth: 0 }}
            activeDot={{ r: 4 }}
            connectNulls={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
