import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ComposeForm } from "./compose-form";

export const dynamic = "force-dynamic";

const SOURCE_LABELS: Record<string, string> = {
  Restoration: "Restoration",
  "Kit Order": "Kit Order",
  Both: "Both",
  Waitlist: "Waitlist",
  "Restoration Waitlist": "Resto Waitlist",
};

const SOURCE_COLORS: Record<string, string> = {
  Restoration: "bg-green-100 text-green-700",
  "Kit Order": "bg-blue-100 text-blue-700",
  Both: "bg-purple-100 text-purple-700",
  Waitlist: "bg-gray-100 text-gray-500",
  "Restoration Waitlist": "bg-amber-100 text-amber-700",
};

export default async function EmailBlastPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const admin = createAdminClient();

  const [{ data: restorationOrders }, { data: shopOrders }, { data: waitlistRows }, { data: rlWaitlist }] =
    await Promise.all([
      admin.from("orders").select("customer_name, customer_email, created_at").neq("status", "awaiting_payment"),
      admin.from("shop_orders").select("customer_name, customer_email, created_at"),
      admin.from("waitlist").select("email, created_at"),
      admin.from("restoration_waitlist").select("name, email, created_at"),
    ]);

  type ContactEntry = { name: string; email: string; source: string; since: string };
  const map = new Map<string, ContactEntry>();

  for (const o of restorationOrders ?? []) {
    const e = (o.customer_email ?? "").toLowerCase().trim();
    if (!e) continue;
    const ex = map.get(e);
    if (ex) {
      if (ex.source === "Kit Order") ex.source = "Both";
    } else {
      map.set(e, { name: o.customer_name ?? "", email: e, source: "Restoration", since: o.created_at });
    }
  }

  for (const o of shopOrders ?? []) {
    const e = (o.customer_email ?? "").toLowerCase().trim();
    if (!e) continue;
    const ex = map.get(e);
    if (ex) {
      if (ex.source === "Restoration") ex.source = "Both";
    } else {
      map.set(e, { name: o.customer_name ?? "", email: e, source: "Kit Order", since: o.created_at });
    }
  }

  for (const w of waitlistRows ?? []) {
    const e = (w.email ?? "").toLowerCase().trim();
    if (!e || map.has(e)) continue;
    map.set(e, { name: "", email: e, source: "Waitlist", since: w.created_at });
  }

  for (const w of rlWaitlist ?? []) {
    const e = (w.email ?? "").toLowerCase().trim();
    if (!e || map.has(e)) continue;
    map.set(e, { name: w.name ?? "", email: e, source: "Restoration Waitlist", since: w.created_at });
  }

  const contacts = Array.from(map.values()).sort(
    (a, b) => new Date(b.since).getTime() - new Date(a.since).getTime()
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-6xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Email Blast</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {contacts.length} unique contacts across restoration orders, kit orders, and waitlists
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

          {/* Compose panel */}
          <div className="order-2 lg:order-1">
            <ComposeForm totalEmails={contacts.length} />
          </div>

          {/* Contact list */}
          <div className="order-1 lg:order-2">
            <div className="bg-white rounded-xl border border-border overflow-hidden">
              <div className="px-5 py-4 border-b border-border flex items-center justify-between">
                <h2 className="font-semibold text-foreground">All Contacts</h2>
                <span className="text-xs text-muted-foreground">{contacts.length} total</span>
              </div>

              <div className="overflow-y-auto max-h-[600px] divide-y divide-border">
                {contacts.length === 0 ? (
                  <div className="p-10 text-center text-muted-foreground text-sm">No contacts yet.</div>
                ) : (
                  contacts.map((c) => (
                    <div key={c.email} className="flex items-center justify-between px-5 py-3 gap-3">
                      <div className="min-w-0">
                        {c.name && (
                          <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                        )}
                        <p className="text-sm text-muted-foreground truncate">{c.email}</p>
                      </div>
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full shrink-0 ${SOURCE_COLORS[c.source] ?? "bg-gray-100 text-gray-500"}`}>
                        {SOURCE_LABELS[c.source] ?? c.source}
                      </span>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
