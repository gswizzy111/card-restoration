"use client";

export function ExportButton({ href }: { href: string }) {
  return (
    <a
      href={href}
      download
      className="flex items-center gap-2 px-4 py-2 rounded-lg bg-emerald-600 text-white text-sm font-bold hover:bg-emerald-700 transition-colors"
    >
      ↓ Export Excel / CSV
    </a>
  );
}
