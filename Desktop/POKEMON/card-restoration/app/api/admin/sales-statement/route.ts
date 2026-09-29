import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

function fmt(cents: number | null | undefined) {
  return ((cents ?? 0) / 100).toFixed(2);
}

export async function GET(request: Request) {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return new Response("Unauthorized", { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const admin = createAdminClient();
  let q = admin
    .from("orders")
    .select("order_number, created_at, customer_name, customer_email, restoration_tier, subtotal_cents, discount_cents, gift_card_discount_cents, shipping_cents, total_cents, refunded_cents, payment_status, affiliate_code, loyalty_discount_percent")
    .not("status", "in", '("cancelled","awaiting_payment")')
    .eq("payment_status", "paid")
    .order("created_at", { ascending: false });

  if (start) q = q.gte("created_at", start);
  if (end) q = q.lte("created_at", end);

  const { data, error } = await q;
  if (error) return new Response("DB error", { status: 500 });

  const rows = data ?? [];

  const TIER_LABELS: Record<string, string> = { basic: "Basic", standard: "Standard", premium: "Premium", elite: "Elite" };

  const csvEscape = (v: string | null | undefined) => {
    const s = String(v ?? "");
    if (s.includes(",") || s.includes('"') || s.includes("\n")) return `"${s.replace(/"/g, '""')}"`;
    return s;
  };

  const header = ["Date", "Order #", "Customer Name", "Customer Email", "Tier", "Subtotal", "Discount", "Gift Card Discount", "Shipping", "Est. Tax", "Total", "Refunded", "Net", "Affiliate Code", "Loyalty Discount %"];

  const lines = [
    header.join(","),
    ...rows.map((o) => {
      const discTotal = (o.discount_cents ?? 0) + (o.gift_card_discount_cents ?? 0);
      const taxable = Math.max(0, (o.subtotal_cents ?? 0) - discTotal);
      const tax = Math.round(taxable * 0.06625);
      const net = (o.total_cents ?? 0) - (o.refunded_cents ?? 0);
      const date = new Date(o.created_at).toLocaleDateString("en-US", { timeZone: "America/New_York" });
      return [
        date,
        `#${o.order_number}`,
        csvEscape(o.customer_name),
        csvEscape(o.customer_email),
        o.restoration_tier ? (TIER_LABELS[o.restoration_tier] ?? o.restoration_tier) : "",
        fmt(o.subtotal_cents),
        fmt(o.discount_cents),
        fmt(o.gift_card_discount_cents),
        fmt(o.shipping_cents),
        fmt(tax),
        fmt(o.total_cents),
        fmt(o.refunded_cents),
        fmt(net),
        o.affiliate_code ?? "",
        String(o.loyalty_discount_percent ?? 0),
      ].join(",");
    }),
  ];

  const csv = lines.join("\r\n");
  const now = new Date().toISOString().slice(0, 10);
  const filename = `card-doc-sales-${now}.csv`;

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
