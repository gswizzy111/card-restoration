import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function IncomingPackagesPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();

  // All buy_label orders that haven't arrived yet
  const { data: incoming } = await admin
    .from("orders")
    .select("id, order_number, customer_name, customer_email, customer_phone, created_at, inbound_carrier, inbound_service_level, inbound_tracking_number, total_cents, status")
    .eq("inbound_method", "buy_label")
    .eq("status", "awaiting_cards")
    .order("created_at", { ascending: true });

  // All buy_label orders that have arrived (recently received/in_progress/completed)
  const { data: arrived } = await admin
    .from("orders")
    .select("id, order_number, customer_name, created_at, inbound_carrier, inbound_tracking_number, status")
    .eq("inbound_method", "buy_label")
    .in("status", ["received", "in_progress", "completed", "shipped_back", "delivered"])
    .order("created_at", { ascending: false })
    .limit(20);

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Incoming Packages</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customers who bought prepaid labels — tracking their cards on the way to you
          </p>
        </div>

        {/* In Transit */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <h2 className="font-heading font-black text-xl text-foreground">In Transit</h2>
            <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-yellow-100 text-yellow-700">
              {incoming?.length ?? 0} package{incoming?.length !== 1 ? "s" : ""}
            </span>
          </div>

          {(!incoming || incoming.length === 0) ? (
            <div className="bg-white rounded-xl border border-border p-10 text-center text-muted-foreground text-sm">
              No packages currently in transit.
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {incoming.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="bg-white rounded-xl border border-border p-5 flex flex-col sm:flex-row sm:items-center gap-4 hover:border-primary/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-heading font-black text-foreground">#{order.order_number}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700">
                        Awaiting Cards
                      </span>
                    </div>
                    <p className="font-medium text-foreground">{order.customer_name}</p>
                    <p className="text-sm text-muted-foreground">{order.customer_email}</p>
                    {order.inbound_carrier && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {order.inbound_carrier} — {order.inbound_service_level}
                      </p>
                    )}
                  </div>

                  <div className="flex flex-col items-start sm:items-end gap-1 shrink-0">
                    {order.inbound_tracking_number ? (
                      <div className="flex items-center gap-2 bg-cyan-50 border border-cyan-200 rounded-lg px-3 py-1.5">
                        <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">Tracking</span>
                        <span className="font-mono font-black text-sm text-cyan-900">{order.inbound_tracking_number}</span>
                      </div>
                    ) : (
                      <span className="text-xs text-muted-foreground italic">No tracking number yet</span>
                    )}
                    <span className="text-xs text-muted-foreground">
                      Ordered {new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

        {/* Recently Arrived */}
        {arrived && arrived.length > 0 && (
          <div>
            <h2 className="font-heading font-black text-xl text-foreground mb-4">Recently Arrived</h2>
            <div className="flex flex-col gap-2">
              {arrived.map((order) => (
                <Link
                  key={order.id}
                  href={`/admin/orders/${order.id}`}
                  className="bg-white rounded-xl border border-border px-5 py-3 flex items-center gap-4 hover:border-primary/40 transition-colors opacity-70 hover:opacity-100"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-heading font-black text-foreground text-sm">#{order.order_number}</span>
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                        {order.status.replace(/_/g, " ")}
                      </span>
                      <span className="text-sm text-muted-foreground">{order.customer_name}</span>
                      {order.inbound_carrier && (
                        <span className="text-xs text-muted-foreground">{order.inbound_carrier}</span>
                      )}
                    </div>
                  </div>
                  {order.inbound_tracking_number && (
                    <span className="font-mono text-xs text-muted-foreground shrink-0">{order.inbound_tracking_number}</span>
                  )}
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
