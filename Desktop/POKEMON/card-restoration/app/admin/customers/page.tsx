import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { ExportButton } from "./export-button";

export const dynamic = "force-dynamic";

type Customer = {
  name: string;
  email: string;
  phone: string;
  source: string;
  firstOrder: string;
  totalOrders: number;
};

export default async function CustomersPage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const admin = createAdminClient();

  const [{ data: restorationOrders }, { data: shopOrders }] = await Promise.all([
    admin.from("orders")
      .select("customer_name, customer_email, customer_phone, created_at")
      .neq("status", "awaiting_payment")
      .order("created_at", { ascending: true }),
    admin.from("shop_orders")
      .select("customer_name, customer_email, customer_phone, created_at")
      .order("created_at", { ascending: true }),
  ]);

  // Merge all rows and deduplicate by email, keeping earliest order date + counting all orders
  const map = new Map<string, Customer>();

  for (const o of restorationOrders ?? []) {
    const email = (o.customer_email ?? "").toLowerCase().trim();
    if (!email) continue;
    const existing = map.get(email);
    if (existing) {
      existing.totalOrders++;
      if (o.created_at < existing.firstOrder) existing.firstOrder = o.created_at;
      if (existing.source === "Kit Order") existing.source = "Both";
    } else {
      map.set(email, {
        name: o.customer_name ?? "",
        email,
        phone: o.customer_phone ?? "",
        source: "Restoration",
        firstOrder: o.created_at,
        totalOrders: 1,
      });
    }
  }

  for (const o of shopOrders ?? []) {
    const email = (o.customer_email ?? "").toLowerCase().trim();
    if (!email) continue;
    const existing = map.get(email);
    if (existing) {
      existing.totalOrders++;
      if (o.created_at < existing.firstOrder) existing.firstOrder = o.created_at;
      if (existing.source === "Restoration") existing.source = "Both";
    } else {
      map.set(email, {
        name: o.customer_name ?? "",
        email,
        phone: o.customer_phone ?? "",
        source: "Kit Order",
        firstOrder: o.created_at,
        totalOrders: 1,
      });
    }
  }

  const customers = Array.from(map.values()).sort(
    (a, b) => new Date(b.firstOrder).getTime() - new Date(a.firstOrder).getTime()
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-5xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Customers</h1>
            <p className="text-muted-foreground text-sm mt-1">{customers.length} unique customers</p>
          </div>
          <ExportButton customers={customers} />
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden">
          {customers.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">No customers yet.</div>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-border bg-secondary/30">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Name</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Email</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden md:table-cell">Phone</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">Source</th>
                  <th className="text-left px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground hidden lg:table-cell">First Order</th>
                  <th className="text-right px-5 py-3 text-xs font-bold uppercase tracking-widest text-muted-foreground">Orders</th>
                </tr>
              </thead>
              <tbody>
                {customers.map((c, i) => (
                  <tr key={c.email} className={`border-b border-border last:border-0 ${i % 2 === 0 ? "" : "bg-secondary/10"}`}>
                    <td className="px-5 py-3 font-medium text-foreground">{c.name || "—"}</td>
                    <td className="px-5 py-3 text-muted-foreground">{c.email}</td>
                    <td className="px-5 py-3 text-muted-foreground hidden md:table-cell">{c.phone || "—"}</td>
                    <td className="px-5 py-3 hidden lg:table-cell">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
                        c.source === "Both" ? "bg-purple-100 text-purple-700" :
                        c.source === "Kit Order" ? "bg-blue-100 text-blue-700" :
                        "bg-green-100 text-green-700"
                      }`}>
                        {c.source}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground hidden lg:table-cell">
                      {new Date(c.firstOrder).toLocaleDateString("en-US")}
                    </td>
                    <td className="px-5 py-3 text-right font-bold text-foreground">{c.totalOrders}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
