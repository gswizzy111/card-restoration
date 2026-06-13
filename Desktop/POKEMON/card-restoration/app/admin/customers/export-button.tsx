"use client";

type Customer = {
  name: string;
  email: string;
  phone: string;
  source: string;
  firstOrder: string;
  totalOrders: number | null;
};

export function ExportButton({ customers }: { customers: Customer[] }) {
  function download() {
    const headers = ["Name", "Email", "Phone", "Source", "First Order", "Total Orders"];
    const rows = customers.map((c) => [
      c.name,
      c.email,
      c.phone,
      c.source,
      new Date(c.firstOrder).toLocaleDateString("en-US"),
      c.totalOrders != null ? String(c.totalOrders) : "",
    ]);

    const csv = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `customers-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <button
      onClick={download}
      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:opacity-90 transition-opacity"
    >
      Download CSV ({customers.length})
    </button>
  );
}
