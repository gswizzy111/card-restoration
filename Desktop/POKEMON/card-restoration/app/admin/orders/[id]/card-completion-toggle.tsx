"use client";

import { useState } from "react";

export function CardCompletionToggle({
  cardId,
  initialCompleted,
}: {
  cardId: string;
  initialCompleted: boolean;
}) {
  const [completed, setCompleted] = useState(initialCompleted);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function toggle() {
    setLoading(true);
    setErr(null);
    try {
      const res = await fetch(`/api/admin/cards/${cardId}/complete`, { method: "POST" });
      const data = await res.json();
      if (res.ok) {
        setCompleted(data.completed);
      } else {
        setErr(data.error ?? "Failed");
      }
    } catch {
      setErr("Network error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex flex-col items-end gap-0.5">
      <button
        onClick={toggle}
        disabled={loading}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
          completed
            ? "bg-green-100 text-green-700 border-green-200 hover:bg-green-200"
            : "bg-white text-muted-foreground border-border hover:border-foreground"
        } disabled:opacity-50`}
      >
        <span
          className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
            completed ? "bg-green-500 border-green-500" : "border-gray-300"
          }`}
        >
          {completed && (
            <svg viewBox="0 0 10 8" fill="none" className="w-2 h-2">
              <path d="M1 4l3 3 5-6" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </span>
        {loading ? "…" : completed ? "Done" : "Mark Done"}
      </button>
      {err && <p className="text-xs text-red-500 max-w-[180px] text-right">{err}</p>}
    </div>
  );
}
