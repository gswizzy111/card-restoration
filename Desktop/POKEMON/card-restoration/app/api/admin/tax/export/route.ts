import { requireAdminOrAccountant } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";

const NJ_TAX_RATE = 0.06625;

function getField(addr: Record<string, string> | null | undefined, key: string): string {
  return addr?.[key] ?? "";
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York", month: "2-digit", day: "2-digit", year: "numeric",
  });
}

function dollars(cents: number) {
  return (cents / 100).toFixed(2);
}

function csvRow(cells: (string | number)[]) {
  return cells.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(",");
}

export async function GET(req: Request) {
  await requireAdminOrAccountant();

  const url = new URL(req.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  const quarter = url.searchParams.get("quarter") ?? "all";
  const month = url.searchParams.get("month") ?? "all";
  const stateFilter = url.searchParams.get("state") ?? "all";
  const typeFilter = url.searchParams.get("type") ?? "all";

  const yearStart = `${year}-01-01T00:00:00.000Z`;
  const yearEnd = `${year + 1}-01-01T00:00:00.000Z`;

  const admin = createAdminClient();

  const [{ data: orders }, { data: shopOrders }] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, ship_from_address, restoration_tier, subtotal_cents, shipping_cents, total_cents, created_at")
      .eq("payment_status", "paid")
      .neq("status", "cancelled")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd)
      .order("created_at", { ascending: false }),
    admin
      .from("shop_orders")
      .select("id, customer_name, customer_email, shipping_address, subtotal_cents, shipping_cents, total_cents, created_at")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);

  type Row = {
    date: string; order_number: string | number; customer_name: string;
    customer_email: string; city: string; state: string; country: string;
    service: string; subtotal_cents: number; shipping_cents: number;
    tax_cents: number; total_cents: number; is_nj: boolean;
    type: string;
  };

  const rows: Row[] = [];

  for (const o of orders ?? []) {
    const addr = o.ship_from_address as Record<string, string> | null;
    const st = getField(addr, "state");
    const isNJ = st === "NJ";
    const isPrep = ["prep", "prep_standard"].includes(o.restoration_tier ?? "");
    const subtotal = o.subtotal_cents ?? 0;
    rows.push({
      date: o.created_at, order_number: o.order_number,
      customer_name: o.customer_name ?? "", customer_email: o.customer_email ?? "",
      city: getField(addr, "city"), state: st, country: getField(addr, "country") || "US",
      service: isPrep ? "Prep" : "Restoration",
      subtotal_cents: subtotal, shipping_cents: o.shipping_cents ?? 0,
      tax_cents: isNJ ? Math.round(subtotal * NJ_TAX_RATE) : 0,
      total_cents: o.total_cents ?? 0, is_nj: isNJ, type: isPrep ? "prep" : "restoration",
    });
  }

  for (const o of shopOrders ?? []) {
    const addr = o.shipping_address as Record<string, string> | null;
    const st = getField(addr, "state");
    const isNJ = st === "NJ";
    const subtotal = o.subtotal_cents ?? 0;
    rows.push({
      date: o.created_at, order_number: "",
      customer_name: o.customer_name ?? "", customer_email: o.customer_email ?? "",
      city: getField(addr, "city"), state: st, country: getField(addr, "country") || "US",
      service: "Kit", subtotal_cents: subtotal, shipping_cents: o.shipping_cents ?? 599,
      tax_cents: isNJ ? Math.round(subtotal * NJ_TAX_RATE) : 0,
      total_cents: o.total_cents ?? 0, is_nj: isNJ, type: "kit",
    });
  }

  rows.sort((a, b) => b.date.localeCompare(a.date));

  let filtered = rows;

  // Month filter (takes priority over quarter)
  if (month !== "all") {
    const m = parseInt(month);
    filtered = filtered.filter((r) => new Date(r.date).getMonth() === m);
  } else if (quarter !== "all") {
    const qMap: Record<string, [number, number]> = {
      Q1: [0, 3], Q2: [3, 6], Q3: [6, 9], Q4: [9, 12],
    };
    const [startM, endM] = qMap[quarter] ?? [0, 12];
    filtered = filtered.filter((r) => {
      const mo = new Date(r.date).getMonth();
      return mo >= startM && mo < endM;
    });
  }

  if (stateFilter !== "all") {
    if (stateFilter === "NJ") filtered = filtered.filter((r) => r.is_nj);
    else if (stateFilter === "non-NJ-US") filtered = filtered.filter((r) => !r.is_nj && r.country === "US");
    else if (stateFilter === "international") filtered = filtered.filter((r) => r.country !== "US");
    else filtered = filtered.filter((r) => r.state === stateFilter);
  }

  if (typeFilter !== "all") {
    filtered = filtered.filter((r) => r.type === typeFilter);
  }

  const header = csvRow(["Date", "Order #", "Customer Name", "Email", "City", "State", "Country", "Service", "Subtotal ($)", "Shipping ($)", "NJ Tax ($)", "Total ($)", "NJ Taxable"]);
  const dataRows = filtered.map((r) =>
    csvRow([
      fmtDate(r.date),
      r.order_number ? `#${r.order_number}` : "",
      r.customer_name, r.customer_email,
      r.city, r.state, r.country, r.service,
      dollars(r.subtotal_cents), dollars(r.shipping_cents),
      dollars(r.tax_cents), dollars(r.total_cents),
      r.is_nj ? "Yes" : "No",
    ])
  );

  const totals = csvRow([
    "TOTALS", "", `${filtered.length} transactions`, "", "", "", "", "",
    dollars(filtered.reduce((s, r) => s + r.subtotal_cents, 0)),
    dollars(filtered.reduce((s, r) => s + r.shipping_cents, 0)),
    dollars(filtered.reduce((s, r) => s + r.tax_cents, 0)),
    dollars(filtered.reduce((s, r) => s + r.total_cents, 0)),
    "",
  ]);

  const csv = [header, ...dataRows, "", totals].join("\r\n");

  const label = month !== "all"
    ? `${new Date(year, parseInt(month), 1).toLocaleString("en-US", { month: "long" })}-${year}`
    : quarter !== "all" ? `${quarter}-${year}` : String(year);

  return new Response(csv, {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="tax-report-${label}.csv"`,
    },
  });
}
