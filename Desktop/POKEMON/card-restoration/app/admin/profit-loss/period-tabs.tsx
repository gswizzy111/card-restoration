"use client";
import { useRouter } from "next/navigation";

const TABS = [
  { value: "today", label: "Today" },
  { value: "week", label: "This Week" },
  { value: "month", label: "This Month" },
  { value: "all", label: "All Time" },
];

export function PeriodTabs({ current }: { current: string }) {
  const router = useRouter();
  return (
    <div className="flex gap-1 bg-muted rounded-lg p-1">
      {TABS.map((t) => (
        <button
          key={t.value}
          onClick={() => router.push(`/admin/profit-loss?period=${t.value}`)}
          className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
            current === t.value
              ? "bg-white text-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
