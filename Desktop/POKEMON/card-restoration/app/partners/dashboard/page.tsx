import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import { LogSaleButton } from "./log-sale-button";
import { LogReferralButton } from "./log-referral-button";
import { formatCurrency } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function PartnerDashboard() {
  const jar = await cookies();
  const partnerId = jar.get("partner_session")?.value;
  if (!partnerId) redirect("/partners");

  const admin = createAdminClient();

  const { data: partner } = await admin
    .from("partners")
    .select("*")
    .eq("id", partnerId)
    .single();

  if (!partner) redirect("/partners");

  const [{ data: sales }, { data: referrals }] = await Promise.all([
    admin.from("partner_kit_sales").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }),
    admin.from("partner_referrals").select("*").eq("partner_id", partnerId).order("created_at", { ascending: false }),
  ]);

  const totalSold = (sales ?? []).reduce((s, r) => s + r.quantity, 0);
  const remaining = partner.kits_allocated - totalSold;
  const totalProfit = totalSold * 18.50;

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">{partner.store_name ?? partner.name}</h1>
            <p className="text-muted-foreground text-sm mt-1">Partner Dashboard — The Card Doc</p>
          </div>
          <form action="/api/partners/logout" method="POST">
            <button className="text-sm text-muted-foreground hover:text-foreground transition-colors">Sign out</button>
          </form>
        </div>

        {/* Profit banner */}
        <div className="bg-primary rounded-xl p-6 mb-4 flex items-center justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-primary-foreground/70 mb-1">Total Profit Earned</p>
            <p className="font-heading font-black text-4xl text-primary-foreground">${totalProfit.toFixed(2)}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-primary-foreground/70">$18.50 per kit</p>
            <p className="text-sm font-bold text-primary-foreground mt-0.5">{totalSold} kit{totalSold !== 1 ? "s" : ""} sold</p>
          </div>
        </div>

        {/* Kit stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Kits Allocated</p>
            <p className="font-heading font-black text-3xl text-foreground">{partner.kits_allocated}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Kits Sold</p>
            <p className="font-heading font-black text-3xl text-primary">{totalSold}</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Remaining</p>
            <p className={`font-heading font-black text-3xl ${remaining <= 3 ? "text-red-500" : "text-foreground"}`}>{remaining}</p>
          </div>
        </div>

        {/* Actions */}
        <div className="grid grid-cols-2 gap-4 mb-8">
          <LogSaleButton remaining={remaining} />
          <LogReferralButton />
        </div>

        {/* Kit sales history */}
        <div className="bg-white rounded-xl border border-border p-6 mb-4">
          <h2 className="font-heading font-black text-lg text-foreground mb-4">Kit Sales</h2>
          {!sales?.length ? (
            <p className="text-sm text-muted-foreground">No sales logged yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {sales.map((s) => (
                <div key={s.id} className="flex items-center justify-between text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-foreground">{s.quantity} kit{s.quantity > 1 ? "s" : ""} sold</p>
                    {s.notes && <p className="text-muted-foreground text-xs">{s.notes}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(s.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Referrals history */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-4">
            Referrals <span className="text-muted-foreground font-normal text-sm">({referrals?.length ?? 0} total)</span>
          </h2>
          {!referrals?.length ? (
            <p className="text-sm text-muted-foreground">No referrals logged yet.</p>
          ) : (
            <div className="flex flex-col gap-3">
              {referrals.map((r) => (
                <div key={r.id} className="flex items-center justify-between text-sm border-b border-border pb-3 last:border-0 last:pb-0">
                  <div>
                    <p className="font-bold text-foreground">{r.client_name ?? "Client"}</p>
                    {r.notes && <p className="text-muted-foreground text-xs">{r.notes}</p>}
                  </div>
                  <p className="text-xs text-muted-foreground">{new Date(r.created_at).toLocaleDateString()}</p>
                </div>
              ))}
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
