import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

function formatCurrency(cents: number) {
  return `$${(cents / 100).toFixed(2)}`;
}

function formatDate(ts: string) {
  return new Date(ts).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

export default async function AdminGiftCardsPage() {
  const admin = createAdminClient();
  const { data: cards, error } = await admin
    .from("gift_cards")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    return <div className="p-8 text-red-600">Failed to load gift cards: {error.message}</div>;
  }

  const total = cards ?? [];
  const active = total.filter((c) => c.status === "active");
  const depleted = total.filter((c) => c.status === "depleted");
  const totalValueCents = total.reduce((s, c) => s + c.value_cents, 0);
  const totalRemainingCents = total.reduce((s, c) => s + c.remaining_cents, 0);

  return (
    <div className="p-6 md:p-8 max-w-7xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Gift Cards</h1>

      {/* Summary stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Issued</p>
          <p className="text-2xl font-bold">{total.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Active</p>
          <p className="text-2xl font-bold text-green-600">{active.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Total Value Sold</p>
          <p className="text-2xl font-bold">{formatCurrency(totalValueCents)}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-4">
          <p className="text-xs text-muted-foreground mb-1">Outstanding Balance</p>
          <p className="text-2xl font-bold text-blue-600">{formatCurrency(totalRemainingCents)}</p>
        </div>
      </div>

      {total.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground">
          No gift cards issued yet.
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-border">
              <tr>
                <th className="text-left px-4 py-3 font-semibold">Code</th>
                <th className="text-left px-4 py-3 font-semibold">Status</th>
                <th className="text-right px-4 py-3 font-semibold">Value</th>
                <th className="text-right px-4 py-3 font-semibold">Remaining</th>
                <th className="text-left px-4 py-3 font-semibold">Purchaser</th>
                <th className="text-left px-4 py-3 font-semibold">Recipient</th>
                <th className="text-left px-4 py-3 font-semibold">Issued</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {total.map((card) => (
                <tr key={card.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-mono font-semibold text-xs">{card.code}</td>
                  <td className="px-4 py-3">
                    {card.status === "active" ? (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-500">Depleted</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">{formatCurrency(card.value_cents)}</td>
                  <td className="px-4 py-3 text-right font-semibold">
                    {card.remaining_cents === card.value_cents ? (
                      <span className="text-blue-600">{formatCurrency(card.remaining_cents)}</span>
                    ) : card.remaining_cents === 0 ? (
                      <span className="text-gray-400">{formatCurrency(0)}</span>
                    ) : (
                      <span className="text-amber-600">{formatCurrency(card.remaining_cents)}</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="font-medium">{card.purchaser_name ?? "—"}</div>
                    <div className="text-xs text-muted-foreground">{card.purchaser_email}</div>
                  </td>
                  <td className="px-4 py-3">
                    {card.recipient_name ? (
                      <>
                        <div className="font-medium">{card.recipient_name}</div>
                        <div className="text-xs text-muted-foreground">{card.recipient_email}</div>
                      </>
                    ) : (
                      <span className="text-muted-foreground text-xs">Self</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">{formatDate(card.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {depleted.length > 0 && (
        <p className="text-xs text-muted-foreground mt-4 text-right">{depleted.length} depleted card{depleted.length !== 1 ? "s" : ""} shown above.</p>
      )}
    </div>
  );
}
