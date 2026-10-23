import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  QUALITY_LABEL, addDays, backlogKnown, backlogNotes, etToday, formatDay, getBacklogDays, getBacklogNow,
  type BacklogDay, type BacklogQuality,
} from "@/lib/dashboard-metrics";
import { BacklogChart } from "../backlog-chart";
import { CsvButton } from "../csv-button";

export const dynamic = "force-dynamic";

// The site started logging order statuses in May 2026
const HISTORY_START = "2026-05-01";

const RANGES = [
  { key: "30", label: "30 Days" },
  { key: "90", label: "90 Days" },
  { key: "all", label: "All" },
] as const;

const QUALITY_CLS: Record<BacklogQuality, string> = {
  live:          "bg-emerald-100 text-emerald-700",
  recorded:      "bg-teal-50 text-teal-700",
  reconstructed: "bg-slate-100 text-slate-600",
  approximate:   "bg-amber-100 text-amber-700",
  insufficient:  "bg-red-100 text-red-700",
  no_data:       "bg-gray-100 text-gray-600",
};

export default async function BacklogPage({ searchParams }: { searchParams: Promise<{ range?: string }> }) {
  await requireAdmin();
  const { range: rangeParam } = await searchParams;
  const range = RANGES.find((r) => r.key === rangeParam)?.key ?? "90";

  const today = etToday();
  const from = range === "all" ? HISTORY_START : addDays(today, -(Number(range) - 1));
  const chartFrom = addDays(today, -29);
  const admin = createAdminClient();
  // One extra day before the range gives the first row its net change
  const readFrom = addDays(from < chartFrom ? from : chartFrom, -1);
  const [all, now] = await Promise.all([getBacklogDays(admin, readFrom, today), getBacklogNow(admin)]);

  const byDay = new Map(all.map((d) => [d.day, d]));
  const netChange = (d: BacklogDay) => {
    const prev = byDay.get(addDays(d.day, -1));
    return prev && backlogKnown(prev) && backlogKnown(d) ? d.total - prev.total : null;
  };
  const rows = all.filter((d) => d.day >= from).reverse();
  const chartDays = all.filter((d) => d.day >= chartFrom);
  const asOf = new Date(now.as_of).toLocaleTimeString("en-US", { timeZone: "America/New_York", hour: "numeric", minute: "2-digit" });
  const trackedFrom = now.tracking_start
    ? new Date(now.tracking_start).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "long", day: "numeric", year: "numeric" })
    : "tracking began";

  const csv: (string | number)[][] = [
    ["Date", "Total Backlog", "Cards Added", "Cards Completed", "Net Change", "Data quality", "Notes"],
    ...rows.map((d) => {
      const net = netChange(d);
      const known = d.quality !== "no_data";
      return [
        d.day,
        backlogKnown(d) ? d.total : "",
        known ? d.added : "",
        known ? d.completed : "",
        net ?? "",
        QUALITY_LABEL[d.quality],
        backlogNotes(d).join("; "),
      ];
    }),
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div className="flex flex-col sm:flex-row sm:items-end gap-4">
          <div className="flex-1">
            <h1 className="font-heading font-black text-3xl text-foreground">Backlog</h1>
            <p className="text-muted-foreground text-sm mt-1">
              Unfinished cards, counted card by card: cards in paid orders that are Cards Received or In Progress, not yet ticked done.
            </p>
          </div>
          <CsvButton rows={csv} filename={`backlog-${range}-${today}.csv`} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Unfinished Cards Now</p>
            <p className="font-heading font-black text-3xl text-purple-600">{now.total}</p>
            <p className="text-xs text-muted-foreground mt-0.5">as of {asOf} in {now.orders} order{now.orders !== 1 ? "s" : ""}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Full Restoration</p>
            <p className="font-heading font-black text-3xl text-foreground">{now.total - now.prep}</p>
            <p className="text-xs text-muted-foreground mt-0.5">cards</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">PSA Prep</p>
            <p className="font-heading font-black text-3xl text-foreground">{now.prep}</p>
            <p className="text-xs text-muted-foreground mt-0.5">cards</p>
          </div>
        </div>
        {now.unknown_orders > 0 && (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3">
            {now.unknown_orders} open order{now.unknown_orders !== 1 ? "s were" : " was"} entered by hand with no cards or quantity, so {now.unknown_orders !== 1 ? "their cards aren't" : "its cards aren't"} counted. Add the cards to {now.unknown_orders !== 1 ? "those orders" : "that order"} to include them.
          </p>
        )}

        <BacklogChart days={chartDays} />

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-4 border-b border-border">
            <h2 className="font-heading font-black text-lg text-foreground">Day by Day</h2>
            <div className="flex gap-1 bg-secondary/50 rounded-lg p-1">
              {RANGES.map((r) => (
                <Link
                  key={r.key}
                  href={`/admin/backlog?range=${r.key}`}
                  className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors ${
                    range === r.key ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {r.label}
                </Link>
              ))}
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-secondary/40 text-left text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-2.5 whitespace-nowrap">Date</th>
                  <th className="px-4 py-2.5 whitespace-nowrap text-right">Total Backlog</th>
                  <th className="px-4 py-2.5 whitespace-nowrap text-right">Cards Added</th>
                  <th className="px-4 py-2.5 whitespace-nowrap text-right">Cards Completed</th>
                  <th className="px-4 py-2.5 whitespace-nowrap text-right">Net Change</th>
                  <th className="px-4 py-2.5">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {rows.map((d) => {
                  const net = netChange(d);
                  const known = d.quality !== "no_data";
                  const notes = backlogNotes(d);
                  return (
                    <tr key={d.day} className={d.quality === "live" ? "bg-emerald-50/40" : undefined}>
                      <td className="px-4 py-2.5 whitespace-nowrap font-semibold text-foreground">
                        {formatDay(d.day, { weekday: "short", month: "short", day: "numeric", year: "numeric" })}
                      </td>
                      <td className="px-4 py-2.5 text-right font-bold tabular-nums text-foreground">
                        {backlogKnown(d) ? d.total : <span className="text-muted-foreground font-normal">—</span>}
                      </td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{known ? (d.added ? `+${d.added}` : "0") : "—"}</td>
                      <td className="px-4 py-2.5 text-right tabular-nums">{known ? (d.completed ? `−${d.completed}` : "0") : "—"}</td>
                      <td className={`px-4 py-2.5 text-right tabular-nums font-semibold ${net == null ? "text-muted-foreground" : net > 0 ? "text-red-600" : net < 0 ? "text-emerald-700" : "text-muted-foreground"}`}>
                        {net == null ? "—" : net > 0 ? `+${net}` : net < 0 ? `−${Math.abs(net)}` : "0"}
                      </td>
                      <td className="px-4 py-2.5 text-xs text-muted-foreground">
                        <span className={`inline-block mr-2 px-2 py-0.5 rounded-full font-bold whitespace-nowrap ${QUALITY_CLS[d.quality]}`}>
                          {QUALITY_LABEL[d.quality]}{d.quality === "live" ? ` · ${asOf}` : ""}
                        </span>
                        {notes.join(" · ")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        <div className="text-xs text-muted-foreground leading-relaxed flex flex-col gap-1.5">
          <p><strong className="text-foreground">How it&apos;s counted.</strong> A card enters the backlog when its order is marked Cards Received (or In Progress, or when it&apos;s added to an order already in) and leaves when it&apos;s ticked done or its order is Completed, Shipped Back or Delivered. Orders sent back to Awaiting Cards, cancelled or deleted, and refunded cards, also leave it; the notes say so. Cards in manual orders entered without card rows are counted from the order&apos;s quantity. Days are New York days, and each finished day is saved once it&apos;s first shown.</p>
          <p><strong className="text-foreground">Recorded</strong> days were logged move by move from {trackedFrom}. <strong className="text-foreground">Rebuilt</strong> days come from the order status history, where a card ticked done inside an order that was still open has no finish date, so it counts as unfinished until its order closed. <strong className="text-foreground">Approximate</strong> and <strong className="text-foreground">Insufficient data</strong> days had orders whose arrival wasn&apos;t logged (they skipped Cards Received): up to 10% of cards may be missing from an approximate day, and more than that from an insufficient one, so no total is given. Orders deleted before {trackedFrom} can&apos;t be rebuilt. When card rows are entered on an order that was counted by its quantity, the change shows as a recount, not as cards added.</p>
        </div>
      </div>
    </div>
  );
}
