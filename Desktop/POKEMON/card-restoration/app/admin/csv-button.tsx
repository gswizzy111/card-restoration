"use client";

// Downloads the rows shown on the page as a CSV file (built in the browser).
function cell(v: string | number) {
  const s = String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CsvButton({ rows, filename }: { rows: (string | number)[][]; filename: string }) {
  function download() {
    const csv = rows.map((r) => r.map(cell).join(",")).join("\n");
    const url = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  }
  return (
    <button
      type="button"
      onClick={download}
      className="h-9 px-4 rounded-lg border border-border bg-white text-sm font-semibold text-foreground hover:border-foreground/40 transition-colors"
    >
      Download CSV
    </button>
  );
}
