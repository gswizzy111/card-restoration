import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";

export const dynamic = "force-dynamic";

const STATUS_STYLES: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved:    "bg-green-100 text-green-700",
  closed:      "bg-gray-100 text-gray-500",
};

const PRIORITY_STYLES: Record<string, string> = {
  low:    "bg-gray-100 text-gray-500",
  normal: "bg-blue-100 text-blue-600",
  high:   "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

export default async function CasesPage({ searchParams }: { searchParams: Promise<{ filter?: string; type?: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const sp = await searchParams;
  const filter = sp.filter ?? "open";
  const typeFilter = sp.type ?? "all";

  const admin = createAdminClient();
  let query = admin.from("cases").select("*").order("updated_at", { ascending: false });

  if (filter === "open") query = query.in("status", ["open", "in_progress"]);
  else if (filter === "resolved") query = query.in("status", ["resolved", "closed"]);

  if (typeFilter === "internal") query = query.eq("type", "internal");
  else if (typeFilter === "support") query = query.eq("type", "support");

  const { data: cases } = await query;
  const list = cases ?? [];

  const filterBtn = (label: string, value: string, param: string, current: string) => {
    const sp2 = new URLSearchParams({ filter, type: typeFilter, [param]: value });
    const active = current === value;
    return (
      <Link
        key={value}
        href={`/admin/cases?${sp2}`}
        className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${active ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/40"}`}
      >
        {label}
      </Link>
    );
  };

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-4xl mx-auto px-6 py-10">

        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-heading font-black text-3xl text-foreground">Cases</h1>
            <p className="text-muted-foreground text-sm mt-0.5">{list.length} case{list.length !== 1 ? "s" : ""}</p>
          </div>
          <Link href="/admin/cases/new" className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center">
            + New Case
          </Link>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-4 mb-6">
          <div className="flex gap-1.5">
            {filterBtn("Open", "open", "filter", filter)}
            {filterBtn("Resolved", "resolved", "filter", filter)}
            {filterBtn("All", "all", "filter", filter)}
          </div>
          <div className="flex gap-1.5">
            {filterBtn("All Types", "all", "type", typeFilter)}
            {filterBtn("Internal", "internal", "type", typeFilter)}
            {filterBtn("Support", "support", "type", typeFilter)}
          </div>
        </div>

        {list.length === 0 ? (
          <div className="bg-white rounded-xl border border-border p-16 text-center">
            <p className="font-heading font-black text-lg text-foreground">No cases found</p>
            <p className="text-sm text-muted-foreground mt-1">
              <Link href="/admin/cases/new" className="text-primary hover:underline">Open a new case</Link>
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {list.map((c) => (
              <Link key={c.id} href={`/admin/cases/${c.id}`} className="block bg-white rounded-xl border border-border p-5 hover:border-primary/40 transition-colors">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1.5">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${c.type === "support" ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
                        {c.type === "support" ? "Support" : "Internal"}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status] ?? ""}`}>
                        {c.status.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
                      </span>
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[c.priority] ?? ""}`}>
                        {c.priority.charAt(0).toUpperCase() + c.priority.slice(1)}
                      </span>
                      {c.order_ref && <span className="text-xs font-mono text-muted-foreground">#{c.order_ref}</span>}
                    </div>
                    <p className="font-heading font-black text-base text-foreground truncate">{c.title}</p>
                    {c.type === "support" && c.customer_name && (
                      <p className="text-xs text-muted-foreground mt-0.5">{c.customer_name}{c.customer_email ? ` · ${c.customer_email}` : ""}</p>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground shrink-0 mt-0.5">
                    {new Date(c.updated_at).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
