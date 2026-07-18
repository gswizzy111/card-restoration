import { cookies } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { StatusUpdater, AddNoteForm } from "./case-actions";

export const dynamic = "force-dynamic";

const PRIORITY_STYLES: Record<string, string> = {
  low:    "bg-gray-100 text-gray-500",
  normal: "bg-blue-100 text-blue-600",
  high:   "bg-orange-100 text-orange-700",
  urgent: "bg-red-100 text-red-700",
};

const STATUS_STYLES: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved:    "bg-green-100 text-green-700",
  closed:      "bg-gray-100 text-gray-500",
};

export default async function CaseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  const { id } = await params;
  const admin = createAdminClient();

  const [{ data: c }, { data: notes }] = await Promise.all([
    admin.from("cases").select("*").eq("id", id).single(),
    admin.from("case_notes").select("*").eq("case_id", id).order("created_at", { ascending: true }),
  ]);

  if (!c) notFound();

  const isSupport = c.type === "support";

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-6">
          <Link href="/admin/cases" className="text-sm text-muted-foreground hover:text-primary transition-colors">← Cases</Link>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-border p-6 mb-5">
          <div className="flex flex-wrap items-start gap-2 mb-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isSupport ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
              {isSupport ? "Support" : "Internal"}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${STATUS_STYLES[c.status] ?? "bg-gray-100 text-gray-500"}`}>
              {c.status.replace("_", " ").replace(/\b\w/g, (l: string) => l.toUpperCase())}
            </span>
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${PRIORITY_STYLES[c.priority] ?? ""}`}>
              {c.priority.charAt(0).toUpperCase() + c.priority.slice(1)} Priority
            </span>
            {c.order_ref && (
              <span className="text-xs font-mono bg-secondary px-2 py-0.5 rounded-full text-muted-foreground">Order #{c.order_ref}</span>
            )}
          </div>

          <h1 className="font-heading font-black text-2xl text-foreground mb-1">{c.title}</h1>
          <p className="text-xs text-muted-foreground mb-4">Opened {new Date(c.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" })}</p>

          {c.description && (
            <p className="text-sm text-foreground whitespace-pre-wrap bg-secondary/40 rounded-lg p-4 mb-4">{c.description}</p>
          )}

          <StatusUpdater caseId={c.id} currentStatus={c.status} />
        </div>

        {/* Customer info — support only */}
        {isSupport && (c.customer_name || c.customer_email || c.customer_phone) && (
          <div className="bg-white rounded-xl border border-border p-6 mb-5">
            <h2 className="font-heading font-black text-base mb-3">Customer</h2>
            <div className="flex flex-col gap-1 text-sm">
              {c.customer_name && <p className="font-medium text-foreground">{c.customer_name}</p>}
              {c.customer_email && <p className="text-muted-foreground">{c.customer_email}</p>}
              {c.customer_phone && <p className="text-muted-foreground">{c.customer_phone}</p>}
            </div>
          </div>
        )}

        {/* Notes thread */}
        <div className="bg-white rounded-xl border border-border overflow-hidden mb-5">
          <div className="px-6 py-4 border-b border-border">
            <h2 className="font-heading font-black text-base">Notes</h2>
          </div>

          {(!notes || notes.length === 0) ? (
            <p className="px-6 py-8 text-sm text-muted-foreground text-center">No notes yet. Add one below.</p>
          ) : (
            <div className="divide-y divide-border">
              {notes.map((note) => (
                <div key={note.id} className={`px-6 py-4 ${note.is_customer_visible ? "bg-blue-50/50" : ""}`}>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-xs text-muted-foreground">
                      {new Date(note.created_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                    </span>
                    {note.is_customer_visible && (
                      <span className="text-xs font-bold px-2 py-0.5 rounded-full bg-blue-100 text-blue-700">Emailed to customer</span>
                    )}
                  </div>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{note.body}</p>
                </div>
              ))}
            </div>
          )}

          <div className="px-6 py-5 border-t border-border bg-secondary/20">
            <AddNoteForm caseId={c.id} isSupport={isSupport} hasEmail={!!c.customer_email} />
          </div>
        </div>

      </div>
    </div>
  );
}
