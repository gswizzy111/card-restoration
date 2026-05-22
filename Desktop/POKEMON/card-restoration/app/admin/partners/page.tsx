import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { NewPartnerForm } from "./new-partner-form";
import { AllocateForm } from "./allocate-form";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  const admin = createAdminClient();

  const { data: partners } = await admin
    .from("partners")
    .select("*")
    .order("created_at", { ascending: false });

  const partnerIds = (partners ?? []).map((p) => p.id);

  const [{ data: allSales }, { data: allReferrals }] = await Promise.all([
    partnerIds.length > 0
      ? admin.from("partner_kit_sales").select("partner_id, quantity, notes, created_at").in("partner_id", partnerIds)
      : { data: [] },
    partnerIds.length > 0
      ? admin.from("partner_referrals").select("partner_id, client_name, notes, created_at").in("partner_id", partnerIds)
      : { data: [] },
  ]);

  type Sale = { partner_id: string; quantity: number; notes: string | null; created_at: string };
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Partners</h1>
            <p className="text-muted-foreground text-sm mt-1">{partners?.length ?? 0} active partners</p>
          </div>
          <div className="flex items-center gap-4">
            <Link href="/admin" className="text-sm font-medium text-primary hover:text-primary/80 transition-colors">
              ← Orders
            </Link>
          </div>
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
              const totalSold = sales.reduce((s, r) => s + r.quantity, 0);
              const remaining = partner.kits_allocated - totalSold;

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
                    <div className="flex gap-4 text-center shrink-0">
                      <div>
                        <p className="text-2xl font-heading font-black text-foreground">{partner.kits_allocated}</p>
                        <p className="text-xs text-muted-foreground">Allocated</p>
                      </div>
                      <div>
                        <p className="text-2xl font-heading font-black text-primary">{totalSold}</p>
                        <p className="text-xs text-muted-foreground">Sold</p>
                      </div>
                      <div>
                        <p className={`text-2xl font-heading font-black ${remaining <= 3 ? "text-red-500" : "text-foreground"}`}>{remaining}</p>
                        <p className="text-xs text-muted-foreground">Left</p>
                      </div>
                      <div>
                        <p className="text-2xl font-heading font-black text-foreground">{referrals.length}</p>
                        <p className="text-xs text-muted-foreground">Referrals</p>
                      </div>
                    </div>
                  </div>

                  {/* Allocate kits */}
                  <div className="mb-5">
                    <AllocateForm partnerId={partner.id} current={partner.kits_allocated} />
                  </div>

                  {/* Sales + referrals detail */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-5 border-t border-border pt-5">
                    <div>
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-2">Kit Sales</p>
                      {sales.length === 0 ? (
                        <p className="text-sm text-muted-foreground">None yet</p>
                      ) : (
                        <div className="flex flex-col gap-1.5">
                          {sales.map((s, i) => (
                            <div key={i} className="text-sm flex justify-between">
                              <span className="text-foreground">{s.quantity} kit{s.quantity > 1 ? "s" : ""}{s.notes ? ` — ${s.notes}` : ""}</span>
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
