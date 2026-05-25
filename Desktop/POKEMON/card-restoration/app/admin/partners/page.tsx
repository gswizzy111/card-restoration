import { createAdminClient } from "@/lib/supabase/admin";
import { NewPartnerForm } from "./new-partner-form";
import { AllocateForm } from "./allocate-form";

export const dynamic = "force-dynamic";

const PROFIT = { kit: 18.50, polish: 8.75, spray: 9.10 };

export default async function AdminPartnersPage() {
  const admin = createAdminClient();

  const { data: partners } = await admin
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  const partnerIds = (partners ?? []).map((p) => p.id);

  const [{ data: allSales }, { data: allReferrals }] = await Promise.all([
    partnerIds.length > 0
      ? admin.from("partner_kit_sales").select("partner_id, quantity, notes, created_at, product_type").in("partner_id", partnerIds)
      : { data: [] },
    partnerIds.length > 0
      ? admin.from("partner_referrals").select("partner_id, client_name, notes, created_at").in("partner_id", partnerIds)
      : { data: [] },
  ]);

  type Sale = { partner_id: string; quantity: number; notes: string | null; created_at: string; product_type: string };
  type Referral = { partner_id: string; client_name: string | null; notes: string | null; created_at: string };
  const salesByPartner: Record<string, Sale[]> = {};
  const referralsByPartner: Record<string, Referral[]> = {};
  for (const s of allSales ?? []) {
    if (!salesByPartner[s.partner_id]) salesByPartner[s.partner_id] = [];
    salesByPartner[s.partner_id]!.push(s);
  }
  for (const r of allReferrals ?? []) {
    if (!referralsByPartner[r.partner_id]) referralsByPartner[r.partner_id] = [];
    referralsByPartner[r.partner_id]!.push(r);
  }

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Partners</h1>
          <p className="text-muted-foreground text-sm mt-1">{partners?.length ?? 0} active partners</p>
        </div>

        {/* Create new partner */}
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-4">Add New Partner</h2>
          <NewPartnerForm />
        </div>

        {/* Partner list */}
        {(!partners || partners.length === 0) ? (
          <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
            No partners yet. Add one above.
          </div>
        ) : (
          <div className="flex flex-col gap-4">
            {partners.map((partner) => {
              const sales = salesByPartner[partner.id] ?? [];
              const referrals = referralsByPartner[partner.id] ?? [];

              const kitSales    = sales.filter(s => (s.product_type ?? "kit") === "kit");
              const polishSales = sales.filter(s => s.product_type === "polish");
              const spraySales  = sales.filter(s => s.product_type === "spray");

              const kitsSold    = kitSales.reduce((s, r) => s + r.quantity, 0);
              const polishSold  = polishSales.reduce((s, r) => s + r.quantity, 0);
              const spraySold   = spraySales.reduce((s, r) => s + r.quantity, 0);

              const kitsLeft   = (partner.kits_allocated ?? 0) - kitsSold;
              const polishLeft = (partner.polish_allocated ?? 0) - polishSold;
              const sprayLeft  = (partner.spray_allocated ?? 0) - spraySold;

              const totalProfit = kitsSold * PROFIT.kit + polishSold * PROFIT.polish + spraySold * PROFIT.spray;

              const productLabel = (s: Sale) => {
                if (s.product_type === "polish") return "polish";
                if (s.product_type === "spray") return "spray";
                return `kit${s.quantity > 1 ? "s" : ""}`;
              };

              return (
                <div key={partner.id} className="bg-white rounded-xl border border-border p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4 mb-5">
                    <div>
                      <h3 className="font-heading font-black text-xl text-foreground">{partner.store_name ?? partner.name}</h3>
                      {partner.store_name && <p className="text-sm text-muted-foreground">{partner.name}</p>}
                      <p className="text-xs text-muted-foreground mt-1">
                        Passcode: <span className="font-mono font-bold text-foreground">{partner.passcode}</span>
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-4 text-center">
                      <div>
                        <p className="text-xl font-heading font-black text-foreground">{kitsSold}/{partner.kits_allocated ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Kits sold</p>
                      </div>
                      <div>
                        <p className="text-xl font-heading font-black text-foreground">{polishSold}/{partner.polish_allocated ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Polish sold</p>
                      </div>
                      <div>
                        <p className="text-xl font-heading font-black text-foreground">{spraySold}/{partner.spray_allocated ?? 0}</p>
                        <p className="text-xs text-muted-foreground">Spray sold</p>
                      </div>
                      <div>
                        <p className="text-xl font-heading font-black text-foreground">{referrals.length}</p>
                        <p className="text-xs text-muted-foreground">Referrals</p>
                      </div>
                      <div>
                        <p className="text-xl font-heading font-black text-primary">${totalProfit.toFixed(2)}</p>
                        <p className="text-xs text-muted-foreground">Their profit</p>
                      </div>
                    </div>
                  </div>

                  {/* Allocate */}
                  <div className="mb-5">
                    <AllocateForm
                      partnerId={partner.id}
                      kits={partner.kits_allocated ?? 0}
                      polish={partner.polish_allocated ?? 0}
                      spray={partner.spray_allocated ?? 0}
                    />
                  </div>

                  {/* Sales + referrals */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border pt-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Sales</p>
                      {sales.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None yet</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {sales.map((s, i) => (
                            <div key={i} className="text-sm flex justify-between">
                              <span className="text-foreground">
                                {s.quantity} {productLabel(s)}{s.notes ? ` — ${s.notes}` : ""}
                              </span>
                              <span className="text-muted-foreground text-xs">{new Date(s.created_at).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Referrals</p>
                      {referrals.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None yet</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {referrals.map((r, i) => (
                            <div key={i} className="text-sm flex justify-between">
                              <span className="text-foreground">{r.client_name ?? "Client"}{r.notes ? ` — ${r.notes}` : ""}</span>
                              <span className="text-muted-foreground text-xs">{new Date(r.created_at).toLocaleDateString()}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
