import { createAdminClient } from "@/lib/supabase/admin";
import { syncRefunds } from "@/lib/refund-ledger";
import { addDays, etToday, getBacklogDays } from "@/lib/dashboard-metrics";

// Runs daily after midnight New York time via netlify/functions/cron-dashboard-metrics.mjs
// (New-Website-Concept; both sites share the database). Brings the refund ledger up to
// date with Stripe and saves the finished days of the backlog report.
export async function GET(request: Request) {
  if (request.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }
  const admin = createAdminClient();
  const refunds = await syncRefunds(admin, { minIntervalMs: 0, budgetMs: 20_000 })
    .catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  const today = etToday();
  const backlog = await getBacklogDays(admin, addDays(today, -7), today)
    .then((days) => ({ days: days.length }))
    .catch((e) => ({ error: e instanceof Error ? e.message : String(e) }));
  console.log("[cron/dashboard-metrics]", JSON.stringify({ refunds, backlog }));
  return Response.json({ refunds, backlog });
}
