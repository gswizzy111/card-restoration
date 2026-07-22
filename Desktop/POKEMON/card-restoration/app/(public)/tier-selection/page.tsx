import Link from "next/link";
import { getAllTiers, applyDbOverride, type RestorationTier } from "@/lib/restoration-tiers";
import { createAdminClient } from "@/lib/supabase/admin";
import { getRestorationsOpen } from "@/lib/store-config";
import { CheckCircle, Zap, Star, Crown, Gem } from "lucide-react";
import { WaitlistModal } from "./waitlist-modal";

export const dynamic = "force-dynamic";

const ICON_MAP = {
  regular:       CheckCircle,
  expedited:     Zap,
  premium:       Star,
  ultra_premium: Crown,
  elite:         Gem,
} as const;

type TierStyle = {
  card:      string;
  icon:      string;
  price:     string;
  btn:       string;
  closedBtn: string;
  check:     string;
  badgeCls?: string; // color for the badge banner
};

const STYLES: Record<string, TierStyle> = {
  regular: {
    card:      "border border-amber-300 bg-gradient-to-br from-amber-50 to-orange-50 hover:shadow-lg",
    icon:      "text-amber-600",
    price:     "text-amber-700",
    btn:       "bg-amber-600 text-white hover:bg-amber-700",
    closedBtn: "bg-amber-100 text-amber-700",
    check:     "text-amber-500",
  },
  expedited: {
    card:      "border border-slate-300 bg-gradient-to-br from-slate-50 to-gray-100 hover:shadow-lg",
    icon:      "text-slate-500",
    price:     "text-slate-600",
    btn:       "bg-slate-600 text-white hover:bg-slate-700",
    closedBtn: "bg-slate-100 text-slate-600",
    check:     "text-slate-400",
  },
  premium: {
    card:      "border-2 border-yellow-400 bg-gradient-to-br from-yellow-50 to-amber-100 hover:shadow-xl",
    icon:      "text-yellow-600",
    price:     "text-yellow-700",
    btn:       "bg-yellow-500 text-white hover:bg-yellow-600",
    closedBtn: "bg-yellow-100 text-yellow-700",
    check:     "text-yellow-500",
    badgeCls:  "bg-yellow-500 text-white",
  },
  ultra_premium: {
    card:      "border border-blue-300 bg-gradient-to-br from-blue-50 to-indigo-50 hover:shadow-lg",
    icon:      "text-blue-500",
    price:     "text-blue-600",
    btn:       "bg-blue-600 text-white hover:bg-blue-700",
    closedBtn: "bg-blue-100 text-blue-600",
    check:     "text-blue-400",
    badgeCls:  "bg-blue-500 text-white",
  },
  elite: {
    card:      "border-2 border-cyan-400 bg-gradient-to-br from-cyan-50 to-blue-100 hover:shadow-xl",
    icon:      "text-cyan-600",
    price:     "text-cyan-700",
    btn:       "bg-gradient-to-r from-cyan-500 to-blue-600 text-white hover:opacity-90",
    closedBtn: "bg-cyan-100 text-cyan-700",
    check:     "text-cyan-500",
    badgeCls:  "bg-gradient-to-r from-cyan-500 to-blue-600 text-white",
  },
};

function TierCard({
  tier,
  settingsMap,
  slotCounts,
  restorationsOpen,
}: {
  tier: RestorationTier;
  settingsMap: Record<string, { is_open?: boolean; max_slots?: number | null }>;
  slotCounts: Record<string, number>;
  restorationsOpen: boolean;
}) {
  const style = STYLES[tier.id] ?? STYLES.regular;
  const Icon = ICON_MAP[tier.id as keyof typeof ICON_MAP] ?? CheckCircle;

  const s = settingsMap[tier.id];
  const maxSlots = s?.max_slots ?? null;
  const usedSlots = slotCounts[tier.id] ?? 0;
  const slotsLeft = maxSlots !== null ? Math.max(0, maxSlots - usedSlots) : null;
  const isSoldOut = s?.is_open === false || (slotsLeft !== null && slotsLeft === 0);

  // Badge label: from tier data (DB-overrideable) or slot count banner
  const bannerLabel: string | null = isSoldOut
    ? "SOLD OUT"
    : slotsLeft !== null
    ? `${slotsLeft} slot${slotsLeft !== 1 ? "s" : ""} remaining`
    : (tier.badge ?? null);

  const bannerCls: string = isSoldOut
    ? "bg-gray-400 text-white"
    : slotsLeft !== null
    ? slotsLeft <= 3 ? "bg-red-500 text-white" : "bg-orange-500 text-white"
    : style.badgeCls ?? "bg-gray-600 text-white";

  return (
    <div
      className={`relative rounded-xl overflow-hidden transition-all duration-200 flex flex-col ${style.card} ${(isSoldOut || !restorationsOpen) ? "opacity-60" : ""}`}
    >
      {/* Top banner — always present so all cards align vertically */}
      {bannerLabel ? (
        <div className={`text-xs font-bold text-center py-1.5 tracking-wide ${bannerCls}`}>
          {bannerLabel}
        </div>
      ) : (
        <div className="py-1.5" />
      )}

      <div className="p-6 flex flex-col flex-1">
        {/* Icon & Name */}
        <div className="flex items-start gap-3 mb-5">
          <Icon className={`w-7 h-7 flex-shrink-0 mt-0.5 ${style.icon}`} />
          <div>
            <h3 className="font-heading text-2xl font-bold text-foreground leading-tight">
              {tier.name}
            </h3>
            <p className="text-sm text-muted-foreground mt-0.5">{tier.description}</p>
          </div>
        </div>

        {/* Price */}
        <div className="mb-6">
          <div className={`text-4xl font-bold ${style.price}`}>
            {tier.pricing_type === "percentage"
              ? `${((tier.pricing_rate ?? 0) * 100).toFixed(0)}%`
              : `$${(tier.price_cents / 100).toFixed(2)}`}
          </div>
          <p className="text-sm text-muted-foreground mt-0.5">
            {tier.pricing_type === "percentage"
              ? `of declared card value · cards $${((tier.min_card_value_cents ?? 0) / 100).toFixed(0)}+`
              : "per card"}
          </p>
        </div>

        {/* CTA Button */}
        {isSoldOut ? (
          <div className="w-full py-2.5 px-4 rounded-full font-semibold text-center text-sm bg-gray-200 text-gray-500 cursor-not-allowed mb-6">
            Sold Out
          </div>
        ) : !restorationsOpen ? (
          <div className={`w-full py-2.5 px-4 rounded-full font-semibold text-center text-sm cursor-not-allowed mb-6 ${style.closedBtn}`}>
            Currently Closed
          </div>
        ) : (
          <Link
            href={`/restoration?tier=${tier.id}`}
            className={`w-full py-2.5 px-4 rounded-full font-semibold text-center text-sm block transition-all duration-150 mb-6 ${style.btn}`}
          >
            Select {tier.name}
          </Link>
        )}

        {/* Features */}
        <div className="border-t border-black/10 pt-4 space-y-2.5 flex-1">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Turnaround</span>
            <span className="font-medium text-foreground">
              {tier.turnaround_min_days}–{tier.turnaround_max_days} days{" "}
              <span className="text-xs text-muted-foreground">(est.)</span>
            </span>
          </div>
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">Card value</span>
            <span className="font-medium text-foreground">
              {tier.max_card_value_cents === null
                ? "Unlimited"
                : `Up to $${(tier.max_card_value_cents / 100).toLocaleString()}`}
            </span>
          </div>
          {tier.includes_notes && (
            <div className="flex items-center gap-2 text-sm">
              <span className={style.check}>✓</span>
              <span className="text-muted-foreground">Grader notes included</span>
            </div>
          )}
          {tier.includes_video && (
            <div className="flex items-center gap-2 text-sm">
              <span className={style.check}>✓</span>
              <span className="text-muted-foreground">Video showcase</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default async function TierSelectionPage() {
  const restorationsOpen = await getRestorationsOpen();
  const defaultTiers = getAllTiers();
  const admin = createAdminClient();

  const [{ data: paidOrders }] = await Promise.all([
    admin.from("orders").select("restoration_tier").eq("payment_status", "paid").not("restoration_tier", "is", null),
  ]);

  // Try extended columns for tier overrides; fall back to basic
  const { data: extSettings, error: extErr } = await admin
    .from("restoration_settings")
    .select("tier, is_open, max_slots, display_name, price_cents, pricing_rate, min_card_value_cents, turnaround_min_days, turnaround_max_days, description, includes_notes, includes_video, badge");

  const settingsRaw = extErr
    ? ((await admin.from("restoration_settings").select("tier, is_open, max_slots")).data ?? [])
    : (extSettings ?? []);

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const settingsMap = Object.fromEntries((settingsRaw as any[]).map((s) => [s.tier, s]));

  const slotCounts: Record<string, number> = {};
  for (const row of paidOrders ?? []) {
    if (row.restoration_tier) slotCounts[row.restoration_tier] = (slotCounts[row.restoration_tier] ?? 0) + 1;
  }

  // Merge DB overrides on top of hardcoded defaults
  const tiers = defaultTiers.map((t) =>
    !extErr ? applyDbOverride(t, settingsMap[t.id] ?? null) : t
  );

  const topTiers    = tiers.filter((t) => ["regular", "expedited", "premium"].includes(t.id));
  const bottomTiers = tiers.filter((t) => ["ultra_premium", "elite"].includes(t.id));

  const sharedProps = { settingsMap, slotCounts, restorationsOpen };

  return (
    <div className="min-h-screen bg-gradient-to-b from-gray-50 to-white">
      {/* Closed banner */}
      {!restorationsOpen && (
        <div className="bg-amber-50 border-b border-amber-200">
          <div className="max-w-5xl mx-auto px-6 py-4 text-center">
            <p className="text-sm font-semibold text-amber-800">
              ⏸ We&apos;re not accepting new restoration orders right now — but you can still browse our pricing below.
            </p>
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-6 md:px-10 py-14 md:py-20">
        <h1 className="font-heading text-4xl md:text-5xl text-foreground mb-3 text-center">
          Choose Your Restoration Level
        </h1>
        <p className="text-lg text-muted-foreground text-center max-w-2xl mx-auto mb-12">
          {restorationsOpen
            ? "Select the tier that best fits your cards' needs. Every tier includes professional grader notes."
            : "We're temporarily closed. Browse our pricing below and join the waitlist to be notified when we reopen."}
        </p>

        {/* Top row: Bronze · Silver · Gold */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 mb-5">
          {topTiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} {...sharedProps} />
          ))}
        </div>

        {/* Bottom row: Platinum · Diamond */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          {bottomTiers.map((tier) => (
            <TierCard key={tier.id} tier={tier} {...sharedProps} />
          ))}
        </div>

        {/* Turnaround disclaimer */}
        <details className="mt-8 border border-amber-200 bg-amber-50 rounded-lg group">
          <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none">
            <div className="flex items-center gap-2.5">
              <span className="text-amber-600 text-base">⚠️</span>
              <span className="text-sm font-semibold text-amber-800">About our turnaround time estimates</span>
            </div>
            <span className="text-amber-600 text-sm font-bold group-open:rotate-180 transition-transform duration-150 inline-block">▾</span>
          </summary>
          <div className="px-5 pb-5 text-sm text-amber-900 space-y-2 leading-relaxed border-t border-amber-200 pt-4">
            <p>
              All turnaround times shown are <strong>rough estimates only</strong> and are not a guarantee or promise of completion within any specific timeframe.
            </p>
            <p>
              Actual processing times may be affected by order volume, card condition, shipping delays, holidays, or other circumstances outside our control. We will always do our best to meet or beat the estimated range, but <strong>The Card Doc cannot be held liable</strong> for delays.
            </p>
            <p className="text-xs text-amber-700">
              By placing an order you acknowledge that turnaround times are estimates and agree that delays do not entitle you to a refund or cancellation. See our{" "}
              <Link href="/terms" className="underline hover:text-amber-900">Terms of Service</Link> for full details.
            </p>
          </div>
        </details>

        {/* Waitlist modal — auto-opens when closed */}
        {!restorationsOpen && <WaitlistModal />}

        {/* Footer info */}
        <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-8 text-center">
          <p className="text-muted-foreground">
            All tiers include professional restoration and{" "}
            <span className="font-semibold text-foreground">grader notes</span>. Not sure which tier fits?{" "}
            <Link href="/how-it-works" className="text-[#1a8fe0] hover:underline font-semibold">
              Learn what we can restore
            </Link>
            .
          </p>
        </div>
      </div>
    </div>
  );
}
