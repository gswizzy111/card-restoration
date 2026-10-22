import Link from "next/link";
import { requireAdmin } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { orderLabel } from "@/lib/card-inquiries";
import { NOTICE_LABEL, UNCLAIMED_DAYS, type NoticeKind } from "@/lib/unclaimed";
import { NoticeForm } from "./notice-form";

export const dynamic = "force-dynamic";

const DAY = 24 * 60 * 60 * 1000;
const daysSince = (iso: string) => Math.floor((Date.now() - new Date(iso).getTime()) / DAY);
const date = (iso: string) => new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "America/New_York" });

/**
 * Unclaimed property (Terms Section 21): orders that are finished but not
 * shipped back, or whose return came back undeliverable, with the dated log
 * of every notice. After 90 days from the first notice an order is listed as
 * escalated. There are no sale, disposal or ownership actions here.
 */
export default async function UnclaimedPage() {
  await requireAdmin();
  const admin = createAdminClient();
  const fields = "id, order_number, customer_name, customer_email, status, outbound_tracking_status, updated_at";
  const [{ data: completed }, { data: undeliverable }] = await Promise.all([
    admin.from("orders").select(fields).eq("status", "completed"),
    admin.from("orders").select(fields).in("outbound_tracking_status", ["RETURNED", "FAILURE"]).neq("status", "cancelled"),
  ]);
  const orders = [...new Map([...(completed ?? []), ...(undeliverable ?? [])].map((o) => [o.id, o])).values()];
  const { data: notices } = orders.length
    ? await admin.from("order_notices").select("*").in("order_id", orders.map((o) => o.id)).order("sent_at")
    : { data: [] };

  const rows = orders.map((o) => {
    const log = (notices ?? []).filter((n) => n.order_id === o.id);
    const first = log[0]?.sent_at as string | undefined;
    const days = first ? daysSince(first) : null;
    const isUndeliverable = o.outbound_tracking_status === "RETURNED" || o.outbound_tracking_status === "FAILURE";
    return { o, log, first, days, isUndeliverable };
  }).sort((a, b) => (b.days ?? -1) - (a.days ?? -1));

  const groups = [
    { title: `Escalated: ${UNCLAIMED_DAYS}+ days since the first notice`, rows: rows.filter((r) => (r.days ?? -1) >= UNCLAIMED_DAYS) },
    { title: "Notified", rows: rows.filter((r) => r.days !== null && r.days < UNCLAIMED_DAYS) },
    { title: "No notice yet", rows: rows.filter((r) => r.days === null) },
  ];

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Unclaimed</h1>
          <p className="text-sm text-muted-foreground mt-1 max-w-3xl">
            Finished orders not yet shipped back, and returns that came back undeliverable. Send and log notices here. Under Terms Section 21, 90 days after
            the first written notice an order can be escalated (more notices, pausing non-essential work, proposing storage charges if properly disclosed),
            but we never take ownership, sell or dispose of a customer&apos;s card on that basis. Talk to New Jersey counsel before anything beyond notices.
          </p>
        </div>

        {groups.map((g) => (
          <section key={g.title} className="bg-white rounded-xl border border-border p-6">
            <h2 className="font-heading font-black text-lg text-foreground mb-4">{g.title} ({g.rows.length})</h2>
            {g.rows.length === 0 ? (
              <p className="text-sm text-muted-foreground">None.</p>
            ) : (
              <div className="flex flex-col divide-y divide-border">
                {g.rows.map(({ o, log, days, isUndeliverable }) => (
                  <div key={o.id} className="py-4 flex flex-col gap-2">
                    <div className="flex flex-wrap items-center gap-2 text-sm">
                      <Link href={`/admin/orders/${o.id}`} className="font-bold text-foreground hover:text-primary">{orderLabel(o.order_number)}</Link>
                      <span className="text-muted-foreground">{o.customer_name ?? o.customer_email}</span>
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${isUndeliverable ? "bg-red-100 text-red-800" : "bg-secondary text-foreground"}`}>
                        {isUndeliverable ? "Undeliverable" : "Completed, not shipped"}
                      </span>
                      {days !== null && <span className={`text-xs font-semibold ${days >= UNCLAIMED_DAYS ? "text-red-700" : "text-muted-foreground"}`}>{days} day{days === 1 ? "" : "s"} since first notice</span>}
                    </div>
                    {log.length > 0 && (
                      <ul className="text-xs text-muted-foreground flex flex-col gap-0.5">
                        {log.map((n) => (
                          <li key={n.id}>{date(n.sent_at)} · {NOTICE_LABEL[n.kind as NoticeKind]} · {n.channel === "email" ? "emailed" : "other"} by {n.sent_by}{n.note ? ` · ${n.note}` : ""}</li>
                        ))}
                      </ul>
                    )}
                    <NoticeForm orderId={o.id} defaultKind={log.length ? "follow_up" : isUndeliverable ? "undeliverable" : "ready_for_return"} />
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  );
}
