import { createAdminClient } from "@/lib/supabase/admin";
import { getAllTiers } from "@/lib/restoration-tiers";
import { getRestorationsOpen } from "@/lib/store-config";
import { KitRow } from "./kit-row";
import { TierRow } from "./tier-row";
import { RestorationsToggle } from "./restorations-toggle";
import { NotifyWaitlistButton } from "./notify-waitlist-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function StoreSettingsPage() {
  const admin = createAdminClient();

  const [
    { data: products },
    { data: tierSettings },
    waitlistTotalRes,
    waitlistPendingRes,
    { data: paidOrders },
    restorationsOpen,
  ] = await Promise.all([
    admin.from("products").select("id, name, price_cents, inventory_count, display_order").eq("active", true).order("display_order", { ascending: true }),
    admin.from("restoration_settings").select("tier, is_open, max_slots"),
    admin.from("restoration_waitlist").select("*", { count: "exact", head: true }),
    admin.from("restoration_waitlist").select("*", { count: "exact", head: true }).is("notified_at", null),
    admin.from("orders").select("restoration_tier").eq("payment_status", "paid").not("restoration_tier", "is", null),
    getRestorationsOpen(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalWaitlist: number = (waitlistTotalRes as any)?.count ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingWaitlist: number = (waitlistPendingRes as any)?.count ?? 0;

  const settingsMap = Object.fromEntries(
    (tierSettings ?? []).map((s: { tier: string; is_open: boolean; max_slots: number | null }) => [s.tier, s])
  );

  const slotsUsed: Record<string, number> = {};
  for (const o of paidOrders ?? []) {
    if (o.restoration_tier) slotsUsed[o.restoration_tier] = (slotsUsed[o.restoration_tier] ?? 0) + 1;
  }

  const tiers = getAllTiers();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/admin" className="text-sm text-muted-foreground hover:text-primary mb-2 block">← Orders</Link>
          <h1 className="font-heading font-black text-3xl text-foreground">Store Settings</h1>
          <p className="text-muted-foreground text-sm mt-1">Control what&apos;s available for sale right now.</p>
        </div>

        {/* Master Restoration Toggle */}
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-1">Restoration Status</h2>
          <p className="text-xs text-muted-foreground mb-4">Master on/off for all restoration orders. Overrides individual tier settings below.</p>
          <RestorationsToggle initialOpen={restorationsOpen} />
        </div>

        {/* Restoration Tiers */}
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-1">Restoration Tiers</h2>
          <p className="text-xs text-muted-foreground mb-5">Toggle tiers open/closed and set slot limits. Only applies when restorations are open above.</p>

          {!tierSettings ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-bold mb-1">Database table not found.</p>
              <p>Run this SQL in your Supabase SQL Editor to enable this feature:</p>
              <pre className="mt-2 text-xs bg-yellow-100 rounded p-2 overflow-x-auto">{`CREATE TABLE IF NOT EXISTS restoration_settings (
  tier TEXT PRIMARY KEY,
  is_open BOOLEAN NOT NULL DEFAULT true,
  max_slots INTEGER DEFAULT NULL
);
INSERT INTO restoration_settings (tier, is_open, max_slots) VALUES
  ('regular', false, NULL),
  ('expedited', true, 4),
  ('premium', true, NULL),
  ('ultra_premium', true, NULL)
ON CONFLICT (tier) DO NOTHING;`}</pre>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tiers.map((tier) => {
                const s = settingsMap[tier.id];
                return (
                  <TierRow
                    key={tier.id}
                    tier={tier.id}
                    name={tier.name}
                    priceCents={tier.price_cents}
                    isOpen={s?.is_open ?? true}
                    maxSlots={s?.max_slots ?? null}
                    slotsUsed={slotsUsed[tier.id] ?? 0}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Restoration Waitlist */}
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-1">Restoration Waitlist</h2>
          <p className="text-xs text-muted-foreground mb-4">
            Customers who signed up to be notified when restorations reopen.
          </p>

          <div className="flex items-center gap-6 mb-5">
            <div className="text-center">
              <p className="font-heading font-black text-3xl text-foreground">{totalWaitlist}</p>
              <p className="text-xs text-muted-foreground">total signed up</p>
            </div>
            <div className="text-center">
              <p className="font-heading font-black text-3xl text-primary">{pendingWaitlist}</p>
              <p className="text-xs text-muted-foreground">not yet notified</p>
            </div>
          </div>

          {pendingWaitlist === 0 ? (
            <p className="text-sm text-muted-foreground">Everyone on the waitlist has already been notified.</p>
          ) : (
            <NotifyWaitlistButton count={pendingWaitlist} />
          )}

          {totalWaitlist > 0 && (
            <p className="text-xs text-muted-foreground mt-3">
              Clicking &ldquo;Notify&rdquo; sends an email (and text if Twilio is configured) to each un-notified customer and marks them as notified.
            </p>
          )}
        </div>

        {/* Kit Inventory */}
        <div className="bg-white rounded-xl border border-border p-6">
          <h2 className="font-heading font-black text-lg text-foreground mb-1">Kit Inventory</h2>
          <p className="text-xs text-muted-foreground mb-4">Set stock to 0 or click &ldquo;Sold Out&rdquo; to hide the add-to-cart button. Customers can still view the product.</p>

          {(!products || products.length === 0) ? (
            <p className="text-sm text-muted-foreground">No active products.</p>
          ) : (
            <div>
              {products.map((p: { id: string; name: string; price_cents: number; inventory_count: number | null }) => (
                <KitRow
                  key={p.id}
                  id={p.id}
                  name={p.name}
                  priceCents={p.price_cents}
                  inventoryCount={p.inventory_count ?? 0}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
