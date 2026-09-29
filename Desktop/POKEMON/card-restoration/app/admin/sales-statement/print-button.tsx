"use client";

export function PrintButton() {
  return (
    <button
      onClick={() => window.print()}
      className="h-9 px-4 bg-primary text-primary-foreground rounded-lg text-sm font-bold hover:bg-primary/90 transition-colors flex items-center gap-2"
    >
      🖨 Save as PDF
    </button>
  );
}
