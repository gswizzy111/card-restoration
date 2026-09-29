"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="text-xs font-semibold text-primary hover:underline"
    >
      Print / Export →
    </button>
  );
}
