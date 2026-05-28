import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

type Subscription = {
  id: string;
  stripe_subscription_id: string;
  stripe_customer_id: string | null;
  customer_name: string;
  customer_email: string;
  customer_phone: string | null;
  shipping_address: {
    street1: string;
    street2?: string | null;
    city: string;
    state: string;
    zip: string;
    country?: string;
  } | null;
  status: string;
  created_at: string;
  cancelled_at: string | null;
};

export default async function AdminSubscriptionsPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    redirect("/admin/login");
  }

  const admin = createAdminClient();
  const { data } = await admin
    .from("subscriptions")
    .select("*")
    .order("created_at", { ascending: false });

  const subscriptions: Subscription[] = (data ?? []) as Subscription[];
  const activeCount = subscriptions.filter((s) => s.status === "active").length;

  function formatAddress(addr: Subscription["shipping_address"]): string {
    if (!addr) return "—";
    const parts = [
      addr.street1,
      addr.street2,
      `${addr.city}, ${addr.state} ${addr.zip}`,
    ].filter(Boolean);
    return parts.join(", ");
  }

  function formatDate(iso: string) {
    return new Date(iso).toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  }

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {activeCount} active subscriber{activeCount !== 1 ? "s" : ""}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-1">Active</p>
          <p className="font-heading font-black text-4xl text-primary">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-border p-6">
          <p className="text-sm text-muted-foreground mb-1">Total All Time</p>
          <p className="font-heading font-black text-4xl text-foreground">{subscriptions.length}</p>
        </div>
      </div>

      {/* List */}
      {subscriptions.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-8 text-center">
          <p className="text-muted-foreground text-sm">No subscriptions yet.</p>
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {subscriptions.map((sub) => (
            <div
              key={sub.id}
              className="bg-white rounded-xl border border-border p-6 flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4"
            >
              {/* Customer info */}
              <div className="flex flex-col gap-1">
                <div className="flex items-center gap-3">
                  <p className="font-heading font-black text-lg text-foreground leading-none">
                    {sub.customer_name}
                  </p>
                  {sub.status === "active" ? (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-green-100 text-green-800">
                      Active
                    </span>
                  ) : (
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                      Cancelled
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground">{sub.customer_email}</p>
                {sub.customer_phone && (
                  <p className="text-sm text-muted-foreground">{sub.customer_phone}</p>
                )}
                <p className="text-sm text-muted-foreground mt-1">
                  {formatAddress(sub.shipping_address)}
                </p>
              </div>

              {/* Dates */}
              <div className="flex flex-col gap-1 text-sm text-right shrink-0">
                <p className="text-muted-foreground">
                  Joined{" "}
                  <span className="text-foreground font-medium">{formatDate(sub.created_at)}</span>
                </p>
                {sub.cancelled_at && (
                  <p className="text-muted-foreground">
                    Cancelled{" "}
                    <span className="text-foreground font-medium">
                      {formatDate(sub.cancelled_at)}
                    </span>
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
