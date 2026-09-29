import { requireAdminOrAccountant } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { formatCurrency } from "@/lib/utils";
import Link from "next/link";
import { PrintButton } from "./print-button";
import { ExportButton } from "./export-button";

export const dynamic = "force-dynamic";

const NJ_TAX_RATE = 0.06625;

function fmt(cents: number) {
  return formatCurrency(cents);
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function getState(addr: Record<string, string> | null | undefined): string {
  return addr?.state ?? "";
}

function getCity(addr: Record<string, string> | null | undefined): string {
  return addr?.city ?? "";
}

function getCountry(addr: Record<string, string> | null | undefined): string {
  return addr?.country ?? "US";
}

type TxRow = {
  date: string;
  order_number: string | number;
  customer_name: string;
  customer_email: string;
  city: string;
  state: string;
  country: string;
  service: string;
  subtotal_cents: number;
  shipping_cents: number;
  tax_cents: number;        // NJ tax computed or collected
  total_cents: number;
  is_nj: boolean;
  type: "restoration" | "prep" | "kit";
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

export default async function TaxPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; quarter?: string; month?: string; state?: string; type?: string }>;
}) {
  await requireAdminOrAccountant();

  const { year, quarter, month: monthParam, state: stateFilter, type: typeFilter } = await searchParams;
  const selectedMonth = monthParam && monthParam !== "all" ? monthParam : null;
  const admin = createAdminClient();

  const nowYear = new Date().getFullYear();
  const selectedYear = year ? parseInt(year) : nowYear;
  const yearStart = `${selectedYear}-01-01T00:00:00.000Z`;
  const yearEnd = `${selectedYear + 1}-01-01T00:00:00.000Z`;

  const [{ data: orders }, { data: shopOrders }] = await Promise.all([
    admin
      .from("orders")
      .select("id, order_number, customer_name, customer_email, ship_from_address, restoration_tier, subtotal_cents, shipping_cents, total_cents, payment_status, created_at, status")
      .eq("payment_status", "paid")
      .neq("status", "cancelled")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd)
      .order("created_at", { ascending: false }),
    admin
      .from("shop_orders")
      .select("id, customer_name, customer_email, shipping_address, subtotal_cents, shipping_cents, total_cents, created_at, status")
      .gte("created_at", yearStart)
      .lt("created_at", yearEnd)
      .neq("status", "cancelled")
      .order("created_at", { ascending: false }),
  ]);

  const rows: TxRow[] = [];

  for (const o of orders ?? []) {
    const addr = o.ship_from_address as Record<string, string> | null;
    const st = getState(addr);
    const isNJ = st === "NJ";
    const isPrep = ["prep", "prep_standard"].includes(o.restoration_tier ?? "");
    const subtotal = o.subtotal_cents ?? 0;
    const shipping = o.shipping_cents ?? 0;
    const taxCents = isNJ ? Math.round(subtotal * NJ_TAX_RATE) : 0;
    rows.push({
      date: o.created_at,
      order_number: o.order_number,
      customer_name: o.customer_name ?? "",
      customer_email: o.customer_email ?? "",
      city: getCity(addr),
      state: st,
      country: getCountry(addr),
      service: isPrep ? "Prep" : "Restoration",
      subtotal_cents: subtotal,
      shipping_cents: shipping,
      tax_cents: taxCents,
      total_cents: o.total_cents ?? 0,
      is_nj: isNJ,
      type: isPrep ? "prep" : "restoration",
    });
  }

  for (const o of shopOrders ?? []) {
    const addr = o.shipping_address as Record<string, string> | null;
    const st = getState(addr);
    const isNJ = st === "NJ";
    const subtotal = o.subtotal_cents ?? 0;
    const shipping = o.shipping_cents ?? 599;
    const taxCents = isNJ ? Math.round(subtotal * NJ_TAX_RATE) : 0;
    rows.push({
      date: o.created_at,
      order_number: "",
      customer_name: o.customer_name ?? "",
      customer_email: o.customer_email ?? "",
      city: getCity(addr),
      state: st,
      country: getCountry(addr),
      service: "Kit",
      subtotal_cents: subtotal,
      shipping_cents: shipping,
      tax_cents: taxCents,
      total_cents: o.total_cents ?? 0,
      is_nj: isNJ,
      type: "kit",
    });
  }

  // Sort by date desc
  rows.sort((a, b) => b.date.localeCompare(a.date));

  // Month / Quarter filter (month takes priority)
  let filteredRows = rows;
  if (selectedMonth !== null) {
    const m = parseInt(selectedMonth);
    filteredRows = filteredRows.filter((r) => new Date(r.date).getMonth() === m);
  } else if (quarter && quarter !== "all") {
    const qMap: Record<string, [number, number]> = {
      "Q1": [0, 3], "Q2": [3, 6], "Q3": [6, 9], "Q4": [9, 12],
    };
    const [startM, endM] = qMap[quarter] ?? [0, 12];
    filteredRows = filteredRows.filter((r) => {
      const m = new Date(r.date).getMonth();
      return m >= startM && m < endM;
    });
  }

  // State filter
  if (stateFilter && stateFilter !== "all") {
    if (stateFilter === "NJ") filteredRows = filteredRows.filter((r) => r.is_nj);
    else if (stateFilter === "non-NJ-US") filteredRows = filteredRows.filter((r) => !r.is_nj && r.country === "US");
    else if (stateFilter === "international") filteredRows = filteredRows.filter((r) => r.country !== "US");
    else filteredRows = filteredRows.filter((r) => r.state === stateFilter);
  }

  // Type filter
  if (typeFilter && typeFilter !== "all") {
    filteredRows = filteredRows.filter((r) => r.type === typeFilter);
  }

  // Aggregates across the filtered set
  const totalRevenue = filteredRows.reduce((s, r) => s + r.total_cents, 0);
  const njRows = filteredRows.filter((r) => r.is_nj);
  const njTaxableRevenue = njRows.reduce((s, r) => s + r.subtotal_cents, 0);
  const njTaxCollected = njRows.reduce((s, r) => s + r.tax_cents, 0);
  const njShipping = njRows.reduce((s, r) => s + r.shipping_cents, 0);

  // Quarter breakdown for NJ (full year, not affected by quarter filter)
  const njAllYear = rows.filter((r) => r.is_nj);
  const quarters = ["Q1", "Q2", "Q3", "Q4"].map((q, qi) => {
    const [startM, endM] = [[0,3],[3,6],[6,9],[9,12]][qi];
    const qRows = njAllYear.filter((r) => {
      const m = new Date(r.date).getMonth();
      return m >= startM && m < endM;
    });
    return {
      label: q,
      taxable: qRows.reduce((s, r) => s + r.subtotal_cents, 0),
      tax: qRows.reduce((s, r) => s + r.tax_cents, 0),
      count: qRows.length,
    };
  });

  const availableYears = Array.from({ length: 4 }, (_, i) => nowYear - i);

  const stateOptions = [
    { value: "all", label: "All Locations" },
    { value: "NJ", label: "New Jersey Only" },
    { value: "non-NJ-US", label: "Other US States" },
    { value: "international", label: "International" },
  ];

  const typeOptions = [
    { value: "all", label: "All Services" },
    { value: "restoration", label: "Restoration" },
    { value: "prep", label: "Prep" },
    { value: "kit", label: "Kits" },
  ];

  function buildUrl(params: Record<string, string>) {
    const base: Record<string, string> = {
      year: String(selectedYear),
      ...(quarter ? { quarter } : {}),
      ...(selectedMonth !== null ? { month: selectedMonth } : {}),
      ...(stateFilter ? { state: stateFilter } : {}),
      ...(typeFilter ? { type: typeFilter } : {}),
    };
    const merged = { ...base, ...params };
    const qs = new URLSearchParams(
      Object.fromEntries(Object.entries(merged).filter(([, v]) => v && v !== "all"))
    ).toString();
    return `/admin/tax${qs ? `?${qs}` : ""}`;
  }

  function exportUrl() {
    const params: Record<string, string> = { year: String(selectedYear) };
    if (quarter && quarter !== "all") params.quarter = quarter;
    if (selectedMonth !== null) params.month = selectedMonth;
    if (stateFilter && stateFilter !== "all") params.state = stateFilter;
    if (typeFilter && typeFilter !== "all") params.type = typeFilter;
    const qs = new URLSearchParams(params).toString();
    return `/api/admin/tax/export${qs ? `?${qs}` : ""}`;
  }

  const filterLink = (param: string, value: string, label: string, active: boolean) => (
    <Link
      href={buildUrl({ [param]: value })}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
        active ? "bg-foreground text-background border-foreground" : "bg-white text-muted-foreground border-border hover:border-foreground"
      }`}
    >
      {label}
    </Link>
  );

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-7xl mx-auto px-6 py-10">

        {/* Header */}
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center gap-3">
          <div className="flex-1">
            <h1 className="font-heading font-black text-3xl text-foreground">Tax Reports</h1>
            <p className="text-sm text-muted-foreground mt-0.5">NJ Sales Tax filing reference · {selectedYear}</p>
          </div>
          {/* Year selector */}
          <div className="flex gap-1.5">
            {availableYears.map((y) => (
              <Link
                key={y}
                href={buildUrl({ year: String(y), quarter: "all", state: "all", type: "all" })}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                  y === selectedYear ? "bg-foreground text-background border-foreground" : "bg-white text-muted-foreground border-border hover:border-foreground"
                }`}
              >
                {y}
              </Link>
            ))}
          </div>
        </div>

        {/* NJ Quarterly Breakdown */}
        <div className="bg-white border border-border rounded-xl p-5 mb-6">
          <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-4">NJ Sales Tax — {selectedYear} Quarterly Summary</p>
          <div className="grid grid-cols-4 gap-3">
            {quarters.map((q) => (
              <div key={q.label} className={`rounded-xl border p-4 ${q.count > 0 ? "border-blue-200 bg-blue-50" : "border-border bg-secondary/30"}`}>
                <p className="text-xs font-bold text-muted-foreground mb-2">{q.label}</p>
                <p className="font-heading font-black text-xl text-foreground">{fmt(q.tax)}</p>
                <p className="text-xs text-muted-foreground mt-0.5">tax on {fmt(q.taxable)} taxable</p>
                <p className="text-xs text-muted-foreground">{q.count} NJ transaction{q.count !== 1 ? "s" : ""}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 pt-4 border-t border-border flex flex-wrap gap-6">
            <div>
              <p className="text-xs text-muted-foreground">Total NJ Taxable Revenue ({selectedYear})</p>
              <p className="font-heading font-black text-2xl text-foreground">{fmt(njAllYear.reduce((s, r) => s + r.subtotal_cents, 0))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Total NJ Sales Tax ({selectedYear})</p>
              <p className="font-heading font-black text-2xl text-blue-600">{fmt(njAllYear.reduce((s, r) => s + r.tax_cents, 0))}</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NJ Tax Rate</p>
              <p className="font-heading font-black text-2xl text-foreground">6.625%</p>
            </div>
            <div>
              <p className="text-xs text-muted-foreground">NJ Transactions ({selectedYear})</p>
              <p className="font-heading font-black text-2xl text-foreground">{njAllYear.length}</p>
            </div>
          </div>
        </div>

        {/* Stats cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">Total Revenue</p>
            <p className="font-heading font-black text-2xl text-primary">{fmt(totalRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{filteredRows.length} transactions</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">NJ Taxable</p>
            <p className="font-heading font-black text-2xl text-foreground">{fmt(njTaxableRevenue)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{njRows.length} NJ orders</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">NJ Tax (6.625%)</p>
            <p className="font-heading font-black text-2xl text-blue-600">{fmt(njTaxCollected)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">collected</p>
          </div>
          <div className="bg-white rounded-xl border border-border p-5">
            <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1">NJ Shipping</p>
            <p className="font-heading font-black text-2xl text-foreground">{fmt(njShipping)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">non-taxable</p>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-6 mb-4 items-start">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Quarter</p>
            <div className="flex gap-1.5">
              {filterLink("quarter", "all", "All", !quarter || (quarter === "all" && selectedMonth === null))}
              {["Q1","Q2","Q3","Q4"].map((q) => filterLink("quarter", q, q, quarter === q && selectedMonth === null))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Month</p>
            <div className="flex gap-1 flex-wrap">
              {MONTH_LABELS.map((label, i) => (
                <Link
                  key={i}
                  href={buildUrl({ month: String(i), quarter: "all" })}
                  className={`px-2.5 py-1 rounded-lg text-xs font-bold border transition-colors ${
                    selectedMonth === String(i)
                      ? "bg-foreground text-background border-foreground"
                      : "bg-white text-muted-foreground border-border hover:border-foreground"
                  }`}
                >
                  {label}
                </Link>
              ))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Location</p>
            <div className="flex gap-1.5 flex-wrap">
              {stateOptions.map((o) => filterLink("state", o.value, o.label, (stateFilter ?? "all") === o.value))}
            </div>
          </div>
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1.5">Service</p>
            <div className="flex gap-1.5">
              {typeOptions.map((o) => filterLink("type", o.value, o.label, (typeFilter ?? "all") === o.value))}
            </div>
          </div>
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm text-muted-foreground">{filteredRows.length} transaction{filteredRows.length !== 1 ? "s" : ""} shown</p>
          <div className="flex gap-2">
            <ExportButton href={exportUrl()} />
            <PrintButton />
          </div>
        </div>

        {/* Transaction table */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm font-variant-numeric: tabular-nums">
              <thead>
                <tr className="border-b border-border bg-secondary/40">
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Order #</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Customer</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Location</th>
                  <th className="text-left px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Service</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground whitespace-nowrap">Subtotal</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Shipping</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">NJ Tax</th>
                  <th className="text-right px-4 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground">Total</th>
                </tr>
              </thead>
              <tbody>
                {filteredRows.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-12 text-center text-muted-foreground text-sm">
                      No transactions match these filters.
                    </td>
                  </tr>
                )}
                {filteredRows.map((row, i) => (
                  <tr
                    key={i}
                    className={`border-b border-border last:border-0 transition-colors ${row.is_nj ? "bg-blue-50/60 hover:bg-blue-50" : "hover:bg-secondary/30"}`}
                  >
                    <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">{fmtDate(row.date)}</td>
                    <td className="px-4 py-3">
                      {row.order_number ? (
                        <Link href={`/admin/orders/${row.order_number}`} className="text-xs font-mono font-semibold text-primary hover:underline">
                          #{row.order_number}
                        </Link>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground text-xs">{row.customer_name}</p>
                      <p className="text-muted-foreground text-xs">{row.customer_email}</p>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        {row.is_nj && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-blue-100 text-blue-700">NJ</span>
                        )}
                        {row.country !== "US" && (
                          <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-700">{row.country}</span>
                        )}
                        <span className="text-xs text-muted-foreground">
                          {[row.city, row.state].filter(Boolean).join(", ") || row.country}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                        row.type === "restoration" ? "bg-purple-100 text-purple-700"
                        : row.type === "prep" ? "bg-blue-100 text-blue-700"
                        : "bg-amber-100 text-amber-700"
                      }`}>
                        {row.service}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-semibold text-foreground tabular-nums">{fmt(row.subtotal_cents)}</td>
                    <td className="px-4 py-3 text-right text-xs text-muted-foreground tabular-nums">{fmt(row.shipping_cents)}</td>
                    <td className="px-4 py-3 text-right text-xs tabular-nums">
                      {row.is_nj ? (
                        <span className="font-bold text-blue-600">{fmt(row.tax_cents)}</span>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right text-xs font-black text-foreground tabular-nums">{fmt(row.total_cents)}</td>
                  </tr>
                ))}
              </tbody>
              {filteredRows.length > 0 && (
                <tfoot>
                  <tr className="border-t-2 border-border bg-secondary/40">
                    <td colSpan={5} className="px-4 py-3 text-xs font-bold text-muted-foreground">Totals ({filteredRows.length} transactions)</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-foreground tabular-nums">{fmt(filteredRows.reduce((s, r) => s + r.subtotal_cents, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-foreground tabular-nums">{fmt(filteredRows.reduce((s, r) => s + r.shipping_cents, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-blue-600 tabular-nums">{fmt(filteredRows.reduce((s, r) => s + r.tax_cents, 0))}</td>
                    <td className="px-4 py-3 text-right text-xs font-black text-foreground tabular-nums">{fmt(filteredRows.reduce((s, r) => s + r.total_cents, 0))}</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </div>

        <p className="text-xs text-muted-foreground mt-4 text-center">
          NJ Tax computed at 6.625% of service/product subtotal for customers with a New Jersey shipping address. Shipping charges are non-taxable. Consult your accountant for filing.
        </p>
      </div>
    </div>
  );
}
