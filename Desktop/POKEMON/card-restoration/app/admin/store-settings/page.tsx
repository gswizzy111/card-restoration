import { createAdminClient } from "@/lib/supabase/admin";
import { getAllTiers, applyDbOverride } from "@/lib/restoration-tiers";
import { getRestorationsOpen } from "@/lib/store-config";
import { KitRow } from "./kit-row";
import { TierRow } from "./tier-row";
import { RestorationsToggle } from "./restorations-toggle";
import { NotifyWaitlistButton } from "./notify-waitlist-button";
import Link from "next/link";

export const dynamic = "force-dynamic";

const EXTENDED_SELECT = "tier, is_open, max_slots, display_name, price_cents, pricing_rate, min_card_value_cents, turnaround_min_days, turnaround_max_days, description, includes_notes, includes_video, badge";
const BASIC_SELECT    = "tier, is_open, max_slots";

export default async function StoreSettingsPage() {
  const admin = createAdminClient();

  // Try to load extended tier settings; fall back to basic if migration hasn't run
  let tierSettings: Record<string, unknown>[] | null = null;
  let hasExtendedColumns = false;

  const { data: extData, error: extErr } = await admin
    .from("restoration_settings")
    .select(EXTENDED_SELECT);

  if (!extErr) {
    tierSettings = extData as Record<string, unknown>[];
    hasExtendedColumns = true;
  } else {
    const { data: basicData } = await admin
      .from("restoration_settings")
      .select(BASIC_SELECT);
    tierSettings = basicData as Record<string, unknown>[] | null;
  }

  const [
    { data: products },
    waitlistTotalRes,
    waitlistPendingRes,
    { data: paidOrders },
    restorationsOpen,
  ] = await Promise.all([
    admin.from("products").select("id, name, price_cents, inventory_count, display_order").eq("active", true).order("display_order", { ascending: true }),
    admin.from("restoration_waitlist").select("*", { count: "exact", head: true }),
    admin.from("restoration_waitlist").select("*", { count: "exact", head: true }).is("notified_at", null),
    admin.from("orders").select("restoration_tier").eq("payment_status", "paid").not("restoration_tier", "is", null),
    getRestorationsOpen(),
  ]);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const totalWaitlist: number = (waitlistTotalRes as any)?.count ?? 0;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const pendingWaitlist: number = (waitlistPendingRes as any)?.count ?? 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsMap = Object.fromEntries((tierSettings ?? []).map((s: any) => [s.tier, s]));

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
          <p className="text-muted-foreground text-sm mt-1">Control what&apos;s available for sale and how each tier is configured.</p>
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
          <p className="text-xs text-muted-foreground mb-5">
            Toggle tiers open/closed, set slot limits, and edit pricing, turnaround, and included features.
            Click <strong>▼ Edit</strong> on any tier to expand its settings.
          </p>

          {!tierSettings ? (
            <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg text-sm text-yellow-800">
              <p className="font-bold mb-1">Database table not found.</p>
              <p>Run this SQL in your Supabase SQL Editor to enable this feature:</p>
              <pre className="mt-2 text-xs bg-yellow-100 rounded p-2 overflow-x-auto whitespace-pre-wrap">{`CREATE TABLE IF NOT EXISTS restoration_settings (
  tier TEXT PRIMARY KEY,
  is_open BOOLEAN NOT NULL DEFAULT true,
  max_slots INTEGER DEFAULT NULL
);
INSERT INTO restoration_settings (tier, is_open, max_slots) VALUES
  ('regular', true, NULL), ('expedited', true, NULL),
  ('premium', true, NULL), ('ultra_premium', true, NULL), ('elite', true, NULL)
ON CONFLICT (tier) DO NOTHING;`}</pre>
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {tiers.map((defaultTier) => {
                const row = settingsMap[defaultTier.id] ?? {};
                const effective = hasExtendedColumns ? applyDbOverride(defaultTier, row as Parameters<typeof applyDbOverride>[1]) : defaultTier;
                return (
                  <TierRow
                    key={defaultTier.id}
                    tierId={defaultTier.id}
                    name={effective.name}
                    priceCents={effective.price_cents}
                    pricingType={effective.pricing_type ?? "fixed"}
                    pricingRate={effective.pricing_rate ?? 0}
                    minCardValueCents={effective.min_card_value_cents ?? null}
                    turnaroundMin={effective.turnaround_min_days}
                    turnaroundMax={effective.turnaround_max_days}
                    description={effective.description}
                    includesNotes={effective.includes_notes}
                    includesVideo={effective.includes_video}
                    badge={effective.badge ?? ""}
                    isOpen={(row as { is_open?: boolean })?.is_open ?? true}
                    maxSlots={(row as { max_slots?: number | null })?.max_slots ?? null}
                    slotsUsed={slotsUsed[defaultTier.id] ?? 0}
                    hasExtendedColumns={hasExtendedColumns}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* DB Migration — shown when extended columns are missing */}
        {tierSettings && !hasExtendedColumns && (
          <div className="bg-white rounded-xl border border-amber-300 p-6 mb-6">
            <h2 className="font-heading font-black text-lg text-foreground mb-1">Enable Full Tier Editing</h2>
            <p className="text-xs text-muted-foreground mb-4">
              Run this SQL in your <strong>Supabase SQL Editor</strong> to add price, turnaround, and content editing to each tier.
            </p>
            <pre className="text-xs bg-gray-50 border border-gray-200 rounded-lg p-4 overflow-x-auto whitespace-pre-wrap text-gray-800">{`ALTER TABLE restoration_settings
  ADD COLUMN IF NOT EXISTS display_name TEXT,
  ADD COLUMN IF NOT EXISTS price_cents INTEGER,
  ADD COLUMN IF NOT EXISTS pricing_rate DECIMAL,
  ADD COLUMN IF NOT EXISTS min_card_value_cents INTEGER,
  ADD COLUMN IF NOT EXISTS turnaround_min_days INTEGER,
  ADD COLUMN IF NOT EXISTS turnaround_max_days INTEGER,
  ADD COLUMN IF NOT EXISTS description TEXT,
  ADD COLUMN IF NOT EXISTS includes_notes BOOLEAN,
  ADD COLUMN IF NOT EXISTS includes_video BOOLEAN,
  ADD COLUMN IF NOT EXISTS badge TEXT;

-- Make sure all 5 tiers have a row
INSERT INTO restoration_settings (tier, is_open, max_slots)
VALUES ('elite', true, NULL)
ON CONFLICT (tier) DO NOTHING;`}</pre>
          </div>
        )}

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
