import { cookies, headers } from "next/headers";
import { redirect, notFound } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import Link from "next/link";
import { StatusUpdater, AddNoteForm, CopyLinkButton } from "./case-actions";
import { ORDER_STATUSES, type OrderStatus } from "@/lib/constants";
import { INQUIRY_TYPE, orderLabel } from "@/lib/card-inquiries";
import { isAdmin } from "@/lib/admin-auth";

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
  if (!(await isAdmin())) redirect("/admin/login");

  const { id } = await params;
  const admin = createAdminClient();

  const hdrs = await headers();
  const host = hdrs.get("host") ?? "thecarddoc1.com";
  const proto = host.startsWith("localhost") ? "http" : "https";
  const appUrl = `${proto}://${host}`;

  const [{ data: c }, { data: notes }] = await Promise.all([
    admin.from("cases").select("*").eq("id", id).single(),
    admin.from("case_notes").select("*").eq("case_id", id).order("created_at", { ascending: true }),
  ]);

  if (!c) notFound();

  const isSupport = c.type === "support";
  const isInquiry = c.type === INQUIRY_TYPE;
  // Support cases and card inquiries both have a customer to write back to.
  const hasCustomer = isSupport || isInquiry;

  // Update requests: the order as it stands now, to answer from. Kit orders
  // are filed as K<order number>.
  const kitNumber = isInquiry && c.order_ref && /^K\d+$/.test(c.order_ref) ? Number(c.order_ref.slice(1)) : null;
  const { data: order } = isInquiry && c.order_ref && kitNumber === null
    ? await admin
        .from("orders")
        .select("id, order_number, status, created_at")
        .eq("order_number", c.order_ref)
        .maybeSingle()
    : { data: null };
  const { data: kitOrder } = kitNumber !== null
    ? await admin
        .from("shop_orders")
        .select("id, order_number, status, created_at")
        .eq("order_number", kitNumber)
        .maybeSingle()
    : { data: null };

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-6">
          <Link href="/admin/cases" className="text-sm text-muted-foreground hover:text-primary transition-colors">← Cases</Link>
        </div>

        {/* Header card */}
        <div className="bg-white rounded-xl border border-border p-6 mb-5">
          <div className="flex flex-wrap items-start gap-2 mb-3">
            <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${isInquiry ? "bg-primary text-primary-foreground" : isSupport ? "bg-purple-100 text-purple-700" : "bg-gray-100 text-gray-600"}`}>
              {isInquiry ? "Update Request" : isSupport ? "Support" : "Internal"}
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

        {/* Customer info + complaint link — support cases and card inquiries */}
        {hasCustomer && (
          <div className="bg-white rounded-xl border border-border p-6 mb-5 flex flex-col gap-4">
            {(c.customer_name || c.customer_email || c.customer_phone) && (
              <div>
                <h2 className="font-heading font-black text-base mb-2">Customer</h2>
                <div className="flex flex-col gap-1 text-sm">
                  {c.customer_name && <p className="font-medium text-foreground">{c.customer_name}</p>}
                  {c.customer_email && <p className="text-muted-foreground">{c.customer_email}</p>}
                  {c.customer_phone && <p className="text-muted-foreground">{c.customer_phone}</p>}
                </div>
              </div>
            )}

            {isInquiry && (
              <div>
                <h2 className="font-heading font-black text-base mb-2">Order</h2>
                {order ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="font-heading font-black">{orderLabel(order.order_number)}</span>
                    <span className="font-medium">{ORDER_STATUSES[order.status as OrderStatus]?.label ?? order.status}</span>
                    <span className="text-muted-foreground">
                      {`Placed ${new Date(order.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </span>
                    <Link href={`/admin/orders/${order.id}`} className="font-semibold text-primary hover:underline">Open order →</Link>
                  </div>
                ) : kitOrder ? (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
                    <span className="font-heading font-black">Kit order K{kitOrder.order_number}</span>
                    <span className="font-medium capitalize">{kitOrder.status}</span>
                    <span className="text-muted-foreground">
                      {`Placed ${new Date(kitOrder.created_at).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`}
                    </span>
                    <Link href="/admin/shop-orders" className="font-semibold text-primary hover:underline">Open Kit Orders →</Link>
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">Order #{c.order_ref} wasn&apos;t found.</p>
                )}
              </div>
            )}

            {c.token && (
              <div>
                <h2 className="font-heading font-black text-base mb-2">Complaint Link</h2>
                <p className="text-xs text-muted-foreground mb-2">Send this link to the customer so they can submit their complaint.</p>
                <div className="flex items-center gap-2 bg-secondary/40 rounded-lg px-3 py-2 border border-border">
                  <span className="text-xs font-mono text-foreground truncate flex-1">{appUrl}/cases/{c.token}</span>
                  <CopyLinkButton url={`${appUrl}/cases/${c.token}`} />
                </div>
                {c.complaint_submitted_at && (
                  <p className="text-xs text-green-700 font-semibold mt-2">
                    ✅ Complaint received {new Date(c.complaint_submitted_at).toLocaleString("en-US", { timeZone: "America/New_York", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" })}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Customer complaint — shown when submitted */}
        {isSupport && c.customer_complaint && (
          <div className="bg-amber-50 rounded-xl border border-amber-200 p-6 mb-5">
            <h2 className="font-heading font-black text-base mb-3 text-amber-900">Customer Complaint</h2>
            <p className="text-sm text-amber-900 whitespace-pre-wrap leading-relaxed">{c.customer_complaint}</p>
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
            <AddNoteForm caseId={c.id} isSupport={hasCustomer} isInquiry={isInquiry} hasEmail={!!c.customer_email} />
          </div>
        </div>

      </div>
    </div>
  );
}
