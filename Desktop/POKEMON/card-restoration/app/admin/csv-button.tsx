"use client";

// Downloads the rows shown on the page as a CSV file (built in the browser).
// Text that starts like a formula (=, +, -, @) gets a leading apostrophe so
// spreadsheets show it as text; numbers stay numbers.
function cell(v: string | number) {
  if (typeof v === "number") return String(v);
  const s = /^[=+\-@\t\r]/.test(v) ? `'${v}` : v;
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function CsvButton({ rows, filename }: { rows: (string | number)[][]; filename: string }) {
  function download() {
    const csv = rows.map((r) => r.map(cell).join(",")).join("\r\n");
    // The byte-order mark makes Excel read the file as UTF-8
    const url = URL.createObjectURL(new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  return (
    <button
      type="button"
      onClick={download}
      className="h-9 px-4 rounded-lg border border-border bg-white text-sm font-semibold text-foreground whitespace-nowrap hover:border-foreground/40 transition-colors"
    >
      Download CSV
    </button>
  );
}
