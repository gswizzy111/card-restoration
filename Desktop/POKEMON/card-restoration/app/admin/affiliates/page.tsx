import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { NewAffiliateForm } from "./new-affiliate-form";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Affiliate = {
  id: string;
  name: string;
  code: string;
  created_at: string;
};

type Sale = {
  id: string;
  total_cents: number;
  created_at: string;
  customer_name: string;
  type: "kit" | "restoration";
  summary: string;
};

export default async function AdminAffiliatesPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();

  const { data: affiliates } = await admin
    .from("affiliates")
    .select("*")
    .order("created_at", { ascending: false });

  const allAffiliates: Affiliate[] = affiliates ?? [];

  // Fetch kit orders with affiliate codes
  const { data: kitOrders } = await admin
    .from("shop_orders")
    .select("id, items, total_cents, created_at, status, customer_name, affiliate_code")
    .not("affiliate_code", "is", null)
    .order("created_at", { ascending: false });

  // Fetch restoration orders with affiliate codes
  const { data: restorationOrders } = await admin
    .from("orders")
    .select("id, total_cents, created_at, customer_name, affiliate_code, status")
    .not("affiliate_code", "is", null)
    .neq("status", "awaiting_payment")
    .order("created_at", { ascending: false });

  // Build sales map by code
  const salesByCode: Record<string, Sale[]> = {};

  for (const o of kitOrders ?? []) {
    const code = (o.affiliate_code as string).toUpperCase();
    if (!salesByCode[code]) salesByCode[code] = [];
    const items = Array.isArray(o.items) ? o.items : [];
    const summary = items.map((i: { product_name: string; quantity: number }) => `${i.product_name} ×${i.quantity}`).join(", ") || "Kit order";
    salesByCode[code].push({ id: o.id, total_cents: o.total_cents, created_at: o.created_at, customer_name: o.customer_name, type: "kit", summary });
  }

  for (const o of restorationOrders ?? []) {
    const code = (o.affiliate_code as string).toUpperCase();
    if (!salesByCode[code]) salesByCode[code] = [];
    salesByCode[code].push({ id: o.id, total_cents: o.total_cents, created_at: o.created_at, customer_name: o.customer_name, type: "restoration", summary: "Restoration service" });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Affiliates &amp; Coupons</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allAffiliates.length} code{allAffiliates.length !== 1 ? "s" : ""} · 10% of every sale
          </p>
        </div>
      </div>

      <NewAffiliateForm />

      {allAffiliates.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">No codes yet. Add one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {allAffiliates.map((affiliate) => {
            const sales = salesByCode[affiliate.code.toUpperCase()] ?? [];
            const totalRevenue = sales.reduce((s, o) => s + o.total_cents, 0);
            const earned = Math.round(totalRevenue * 0.1);

            return (
              <div key={affiliate.id} className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-heading font-black text-xl text-foreground">{affiliate.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(affiliate.created_at).toLocaleDateString()}
                    </p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <p className="font-mono font-black text-lg text-foreground tracking-widest">{affiliate.code}</p>
                      <p className="text-xs text-muted-foreground">code</p>
                    </div>
                    <div className="text-center">
                      <p className="font-heading font-black text-lg text-foreground">{sales.length}</p>
                      <p className="text-xs text-muted-foreground">sales</p>
                    </div>
                    <div className="text-center">
                      <p className="font-heading font-black text-lg text-foreground">{formatCurrency(totalRevenue)}</p>
                      <p className="text-xs text-muted-foreground">revenue</p>
                    </div>
                    <div className="text-center">
                      <p className="font-heading font-black text-lg text-green-700">{formatCurrency(earned)}</p>
                      <p className="text-xs text-muted-foreground">earned (10%)</p>
                    </div>
                  </div>
                </div>

                {sales.length > 0 && (
                  <div className="border-t border-border px-6 py-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-3">Recent Sales</p>
                    <div className="flex flex-col gap-2">
                      {sales.slice(0, 5).map((sale) => (
                        <div key={sale.id} className="flex items-center justify-between text-sm">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${sale.type === "kit" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
                              {sale.type === "kit" ? "KIT" : "REST"}
                            </span>
                            <span className="font-medium text-foreground truncate">{sale.customer_name || "Customer"}</span>
                            <span className="text-muted-foreground text-xs truncate hidden sm:block">{sale.summary}</span>
                          </div>
                          <div className="flex items-center gap-3 shrink-0">
                            <span className="text-xs text-muted-foreground">{new Date(sale.created_at).toLocaleDateString()}</span>
                            <span className="font-semibold text-foreground">{formatCurrency(sale.total_cents)}</span>
                            <span className="text-xs text-green-700 font-semibold">+{formatCurrency(Math.round(sale.total_cents * 0.1))}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
