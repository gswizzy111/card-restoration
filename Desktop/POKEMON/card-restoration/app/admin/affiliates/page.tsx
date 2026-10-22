import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { NewAffiliateForm } from "./new-affiliate-form";
import { NewCouponForm } from "./new-coupon-form";
import { EditAffiliateForm } from "./edit-affiliate-form";
import { PortalAccess } from "./portal-access";
import Link from "next/link";
import { formatCurrency } from "@/lib/utils";
import { isAdmin } from "@/lib/admin-auth";
import { COMMISSION_PERCENT, commissionCents, countsForCommission, netCents } from "@/lib/creator-portal";

export const dynamic = "force-dynamic";

type Affiliate = {
  id: string;
  name: string;
  code: string;
  discount_percent: number;
  created_at: string;
  portal_set_up: boolean;
  portal_last_login_at: string | null;
  setup_link_pending: boolean;
};

type Sale = {
  id: string;
  total_cents: number;
  created_at: string;
  customer_name: string;
  type: "kit" | "restoration";
  summary: string;
};

export default async function AdminAffiliatesPage({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  const { edit: editingId } = await searchParams;
  if (!(await isAdmin())) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();

  // Named columns: the portal password and setup link hashes never leave the server
  const { data: affiliates } = await admin
    .from("affiliates")
    .select("id, name, code, discount_percent, created_at, password_hash, portal_last_login_at, setup_token_expires_at")
    .order("created_at", { ascending: false });

  const now = new Date().toISOString();
  const allAffiliates: Affiliate[] = (affiliates ?? []).map(({ password_hash, setup_token_expires_at, ...a }) => ({
    ...a,
    portal_set_up: !!password_hash,
    setup_link_pending: !!setup_token_expires_at && setup_token_expires_at > now,
  }));

  // Fetch kit orders with affiliate codes
  const { data: kitOrders } = await admin
    .from("shop_orders")
    .select("id, items, total_cents, refunded_cents, created_at, status, customer_name, affiliate_code")
    .not("affiliate_code", "is", null)
    .order("created_at", { ascending: false });

  // Fetch restoration orders with affiliate codes
  const { data: restorationOrders } = await admin
    .from("orders")
    .select("id, total_cents, refunded_cents, created_at, customer_name, affiliate_code, status")
    .not("affiliate_code", "is", null)
    .order("created_at", { ascending: false });

  // Build sales map by code
  const salesByCode: Record<string, Sale[]> = {};

  // Counted the same way as on the creator's own dashboard (lib/creator-portal.ts)
  for (const o of kitOrders ?? []) {
    if (!countsForCommission("kit", o.status) || netCents(o.total_cents, o.refunded_cents) <= 0) continue;
    const code = (o.affiliate_code as string).toUpperCase();
    if (!salesByCode[code]) salesByCode[code] = [];
    const items = Array.isArray(o.items) ? o.items : [];
    const summary = items.map((i: { product_name: string; quantity: number }) => `${i.product_name} ×${i.quantity}`).join(", ") || "Kit order";
    salesByCode[code].push({ id: o.id, total_cents: netCents(o.total_cents, o.refunded_cents), created_at: o.created_at, customer_name: o.customer_name, type: "kit", summary });
  }

  for (const o of restorationOrders ?? []) {
    if (!countsForCommission("restoration", o.status) || netCents(o.total_cents, o.refunded_cents) <= 0) continue;
    const code = (o.affiliate_code as string).toUpperCase();
    if (!salesByCode[code]) salesByCode[code] = [];
    salesByCode[code].push({ id: o.id, total_cents: netCents(o.total_cents, o.refunded_cents), created_at: o.created_at, customer_name: o.customer_name, type: "restoration", summary: "Restoration service" });
  }

  return (
    <div className="max-w-4xl mx-auto px-6 py-10">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Affiliates &amp; Coupons</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {allAffiliates.length} code{allAffiliates.length !== 1 ? "s" : ""} · {COMMISSION_PERCENT}% of every sale
          </p>
        </div>
      </div>

      <NewAffiliateForm />
      <NewCouponForm />

      {allAffiliates.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">No codes yet. Add one above.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-6">
          {allAffiliates.map((affiliate) => {
            const sales = salesByCode[affiliate.code.toUpperCase()] ?? [];
            const totalRevenue = sales.reduce((s, o) => s + o.total_cents, 0);
            const earned = commissionCents(totalRevenue);

            return (
              <div key={affiliate.id} className="bg-white rounded-xl border border-border overflow-hidden">
                <div className="p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                  <div>
                    <h2 className="font-heading font-black text-xl text-foreground">{affiliate.name}</h2>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Created {new Date(affiliate.created_at).toLocaleDateString()}
                    </p>
                    {editingId !== affiliate.id && (
                      <Link
                        href={`/admin/affiliates?edit=${affiliate.id}`}
                        scroll={false}
                        className="inline-block mt-2 text-xs font-semibold text-primary hover:underline underline-offset-2"
                      >
                        Edit name, code or discount
                      </Link>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
                    <div className="text-center">
                      <p className="font-mono font-black text-lg text-foreground tracking-widest">{affiliate.code}</p>
                      <p className="text-xs text-muted-foreground">code</p>
                    </div>
                    {affiliate.discount_percent > 0 && (
                      <div className="text-center">
                        <p className="font-heading font-black text-lg text-green-600">{affiliate.discount_percent}%</p>
                        <p className="text-xs text-muted-foreground">customer discount</p>
                      </div>
                    )}
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
                      <p className="text-xs text-muted-foreground">earned ({COMMISSION_PERCENT}%)</p>
                    </div>
                  </div>
                </div>

                {editingId === affiliate.id && <EditAffiliateForm affiliate={affiliate} />}

                <PortalAccess
                  affiliate={{ id: affiliate.id, name: affiliate.name }}
                  setUp={affiliate.portal_set_up}
                  lastLogin={affiliate.portal_last_login_at}
                  linkPending={affiliate.setup_link_pending}
                />

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
                            <span className="text-xs text-green-700 font-semibold">+{formatCurrency(commissionCents(sale.total_cents))}</span>
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
