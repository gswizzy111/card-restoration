import { createAdminClient } from "@/lib/supabase/admin";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_COLORS: Record<string, string> = {
  awaiting_payment: "bg-gray-100 text-gray-600",
  awaiting_cards:   "bg-yellow-100 text-yellow-700",
  received:         "bg-blue-100 text-blue-700",
  in_progress:      "bg-purple-100 text-purple-700",
  completed:        "bg-green-100 text-green-700",
  shipped_back:     "bg-cyan-100 text-cyan-700",
  delivered:        "bg-emerald-100 text-emerald-700",
  cancelled:        "bg-red-100 text-red-700",
};

const PAST = ["shipped_back", "delivered", "cancelled"];

export default async function PrepOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string }>;
}) {
  const { status: statusFilter } = await searchParams;
  const admin = createAdminClient();

  const [{ data: orders }, { data: preGradeServices }] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, customer_phone, total_cents, subtotal_cents, shipping_cents, status, payment_status, created_at, restoration_tier, shipping_label_url, inbound_customs_form_url, inbound_method, insurance_declared_value_cents, slab_crack_count, customer_notes, ship_from_address")
      .in("restoration_tier", ["prep", "prep_standard"])
      .order("created_at", { ascending: false }),
    admin
      .from("order_services")
      .select("order_id, quantity")
      .eq("service_id", "pre_grade_assessment"),
  ]);

  const preGradeByOrder: Record<string, number> = {};
  for (const svc of preGradeServices ?? []) {
    preGradeByOrder[svc.order_id] = svc.quantity ?? 1;
  }

  const orderIds = (orders ?? []).map((o) => o.id);
  const { data: allCards } = orderIds.length > 0
    ? await admin.from("cards").select("order_id, card_name, estimated_value_cents, photo_urls").in("order_id", orderIds)
    : { data: [] };

  const cardsByOrder: Record<string, { name: string; valueCents: number; photo: string | null }[]> = {};
  for (const card of allCards ?? []) {
    if (!cardsByOrder[card.order_id]) cardsByOrder[card.order_id] = [];
    const photos: string[] = Array.isArray(card.photo_urls) ? card.photo_urls : [];
    cardsByOrder[card.order_id].push({
      name: card.card_name,
      valueCents: card.estimated_value_cents ?? 0,
      photo: photos[0] ?? null,
    });
  }

  const all = orders ?? [];
  const ACTIVE_NON_PAID = all.filter((o) => o.status === "awaiting_payment");
  const activeOrders = all.filter((o) => !PAST.includes(o.status) && o.status !== "awaiting_payment");
  const pastOrders = all.filter((o) => PAST.includes(o.status));

  const statusGroups: Record<string, typeof all> = {};
  for (const o of [...activeOrders, ...ACTIVE_NON_PAID]) {
    if (!statusGroups[o.status]) statusGroups[o.status] = [];
    statusGroups[o.status].push(o);
  }

  const displayOrders = statusFilter && statusFilter !== "all"
    ? all.filter((o) => o.status === statusFilter)
    : [...activeOrders, ...ACTIVE_NON_PAID];

  const totalRevenue = all.filter((o) => o.payment_status === "paid").reduce((s, o) => s + (o.total_cents ?? 0), 0);
  const awaitingPaymentCount = ACTIVE_NON_PAID.length;
  const awaitingCardsCount = all.filter((o) => o.status === "awaiting_cards").length;
  const inProgressCount = all.filter((o) => ["received", "in_progress"].includes(o.status)).length;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-3 mb-1">
              <h1 className="font-heading font-black text-3xl text-foreground">Prep Orders</h1>
              <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-blue-100 text-blue-700">
                10–15 day turnaround
              </span>
            </div>
            <p className="text-muted-foreground text-sm">{all.length} total orders · {formatCurrency(totalRevenue)} collected</p>
          </div>
          <Link href="/admin/prep-settings" className="h-9 px-4 bg-secondary text-foreground text-sm font-semibold rounded-lg border border-border hover:bg-secondary/80 transition-colors flex items-center whitespace-nowrap">
            ⚙ Prep Settings
          </Link>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Awaiting Payment</p>
            <p className={`font-heading font-black text-3xl ${awaitingPaymentCount > 0 ? "text-gray-500" : "text-foreground"}`}>{awaitingPaymentCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Awaiting Cards</p>
            <p className={`font-heading font-black text-3xl ${awaitingCardsCount > 0 ? "text-yellow-600" : "text-foreground"}`}>{awaitingCardsCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">In Progress</p>
            <p className={`font-heading font-black text-3xl ${inProgressCount > 0 ? "text-purple-600" : "text-foreground"}`}>{inProgressCount}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Revenue</p>
            <p className="font-heading font-black text-3xl text-primary">{formatCurrency(totalRevenue)}</p>
          </div>
        </div>

        {/* Status filter */}
        <div className="flex gap-2 flex-wrap mb-5">
          {[
            ["all", "All Active"],
            ["awaiting_payment", "Awaiting Payment"],
            ["awaiting_cards", "Awaiting Cards"],
            ["received", "Received"],
            ["in_progress", "In Progress"],
            ["completed", "Completed"],
            ["shipped_back", "Shipped Back"],
          ].map(([val, label]) => {
            const count = val === "all"
              ? [...activeOrders, ...ACTIVE_NON_PAID].length
              : all.filter((o) => o.status === val).length;
            return (
              <Link
                key={val}
                href={`/admin/prep-orders${val !== "all" ? `?status=${val}` : ""}`}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-colors border flex items-center gap-1.5 ${
                  (statusFilter ?? "all") === val
                    ? "bg-foreground text-background border-foreground"
                    : "bg-white text-muted-foreground border-border hover:border-foreground"
                }`}
              >
                {label}
                {count > 0 && (
                  <span className={`text-[10px] font-black px-1.5 py-0.5 rounded-full ${
                    (statusFilter ?? "all") === val ? "bg-white/20 text-white" : "bg-border text-foreground"
                  }`}>{count}</span>
                )}
              </Link>
            );
          })}
        </div>

        {/* Orders table */}
        {displayOrders.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-16 text-center">
            <p className="text-3xl mb-2">🔬</p>
            <p className="font-heading font-black text-lg text-foreground">No prep orders</p>
            <p className="text-sm text-muted-foreground mt-1">Prep orders will appear here once customers submit.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3 mb-10">
            {displayOrders.map((order) => {
              const cards = cardsByOrder[order.id] ?? [];
              const hasLabel = !!order.shipping_label_url;
              const hasCustomsForm = !!order.inbound_customs_form_url;
              const shipFrom = order.ship_from_address as Record<string, string> | null;
              const orderIsIntl = shipFrom?.country && shipFrom.country !== "US";
              const hasInsurance = (order.insurance_declared_value_cents ?? 0) > 0;
              const hasPreGrade = !!preGradeByOrder[order.id];
              const slabCrackCount = order.slab_crack_count ?? 0;

              return (
                <div
                  key={order.id}
                  className={`bg-white rounded-xl border p-5 transition-colors ${
                    order.status === "awaiting_payment" ? "border-gray-200 opacity-70" : "border-border hover:border-primary/30"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-start gap-4">
                    {/* Left: core info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-2 flex-wrap">
                        <Link href={`/admin/orders/${order.id}`} className="font-heading font-black text-foreground hover:text-primary transition-colors">
                          {/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}
                        </Link>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                        </span>
                        <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">
                          🔬 Prep
                        </span>
                        {orderIsIntl && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-indigo-100 text-indigo-700">
                            🌐 {shipFrom?.country}
                          </span>
                        )}
                        {order.payment_status !== "paid" && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-red-100 text-red-600">Unpaid</span>
                        )}
                        {hasInsurance && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700">
                            Insured ${((order.insurance_declared_value_cents ?? 0) / 100).toFixed(0)}
                          </span>
                        )}
                        {hasPreGrade && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-violet-100 text-violet-700">
                            Pre-Grade ×{preGradeByOrder[order.id]}
                          </span>
                        )}
                        {slabCrackCount > 0 && (
                          <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-amber-100 text-amber-700">
                            Slab Crack ×{slabCrackCount}
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-6 mb-3">
                        <div>
                          <p className="font-medium text-foreground">{order.customer_name}</p>
                          <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                          {order.customer_phone && <p className="text-xs text-muted-foreground">{order.customer_phone}</p>}
                        </div>
                        <div className="text-right ml-auto">
                          <p className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(order.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
                          </p>
                        </div>
                      </div>

                      {/* Card list */}
                      {cards.length > 0 && (
                        <div className="border-t border-border pt-3 mt-2">
                          <p className="text-xs font-bold text-muted-foreground uppercase tracking-wide mb-2">
                            {cards.length} card{cards.length !== 1 ? "s" : ""}
                          </p>
                          <div className="flex flex-col gap-1.5">
                            {cards.map((card, i) => (
                              <div key={i} className="flex items-center gap-2.5">
                                {card.photo && (
                                  // eslint-disable-next-line @next/next/no-img-element
                                  <img src={card.photo} alt={card.name} className="w-8 h-8 object-cover rounded border border-border shrink-0" />
                                )}
                                <span className="text-sm text-foreground flex-1 truncate">{card.name}</span>
                                {card.valueCents > 0 && (
                                  <span className={`text-xs font-bold shrink-0 ${card.valueCents >= 150000 ? "text-amber-600" : "text-muted-foreground"}`}>
                                    {formatCurrency(card.valueCents)}
                                    {card.valueCents >= 150000 && " (2%)"}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}

                      {/* Notes */}
                      {order.customer_notes && (
                        <p className="text-xs text-muted-foreground mt-3 italic border-t border-border pt-2">
                          &ldquo;{order.customer_notes}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Actions row */}
                  <div className="flex items-center gap-3 mt-4 pt-4 border-t border-border flex-wrap">
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <span>{order.inbound_method === "buy_label" ? "📦 Prepaid label" : "📬 Self-ship"}</span>
                      {order.shipping_cents ? <span>· {formatCurrency(order.shipping_cents)}</span> : null}
                    </div>
                    {hasLabel && (
                      <a
                        href={order.shipping_label_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-blue-600 hover:text-blue-800 hover:underline flex items-center gap-1"
                      >
                        ⬇ Download Label
                      </a>
                    )}
                    {hasCustomsForm && (
                      <a
                        href={order.inbound_customs_form_url!}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-bold text-teal-600 hover:text-teal-800 hover:underline flex items-center gap-1"
                      >
                        📄 Download Customs Form
                      </a>
                    )}
                    <div className="ml-auto">
                      <Link href={`/admin/orders/${order.id}`} className="text-xs font-bold text-primary hover:underline">
                        View Order →
                      </Link>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Past orders */}
        {pastOrders.length > 0 && (statusFilter === "all" || !statusFilter) && (
          <>
            <h2 className="font-heading font-black text-xl text-foreground mb-4">
              Past Orders <span className="text-sm font-normal text-muted-foreground">({pastOrders.length})</span>
            </h2>
            <div className="flex flex-col gap-3">
              {pastOrders.map((order) => {
                const cards = cardsByOrder[order.id] ?? [];
                return (
                  <Link
                    key={order.id}
                    href={`/admin/orders/${order.id}`}
                    className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors opacity-70 hover:opacity-100"
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-3 mb-1 flex-wrap">
                        <span className="font-heading font-black text-foreground">
                          {/^\d+$/.test(String(order.order_number)) ? `R${order.order_number}` : order.order_number}
                        </span>
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_COLORS[order.status] ?? "bg-gray-100 text-gray-600"}`}>
                          {ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}
                        </span>
                      </div>
                      <p className="font-medium text-foreground">{order.customer_name}</p>
                      <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                      {cards.length > 0 && (
                        <p className="text-sm text-muted-foreground mt-1">{cards.length} cards · {cards.map((c) => c.name).slice(0, 3).join(", ")}{cards.length > 3 ? "…" : ""}</p>
                      )}
                    </div>
                    <div className="flex sm:flex-col items-center sm:items-end gap-4 sm:gap-1 shrink-0">
                      <span className="font-heading font-black text-xl text-primary">{formatCurrency(order.total_cents)}</span>
                      <span className="text-xs text-muted-foreground">
                        {new Date(order.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric" })}
                      </span>
                    </div>
                  </Link>
                );
              })}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
