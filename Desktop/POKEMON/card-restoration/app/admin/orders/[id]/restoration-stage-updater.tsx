"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

const STAGES = [
  "Humidor",
  "Humidity Press",
  "Book",
  "Heat Press",
  "Clamp Work",
  "Book with Weights",
  "Final Dry",
];

export function RestorationStageUpdater({
  orderId,
  currentStage,
}: {
  orderId: string;
  currentStage: string | null;
}) {
  const [loading, setLoading] = useState<string | null>(null);
  const router = useRouter();

  async function setStage(stage: string) {
    if (stage === currentStage) return;
    setLoading(stage);
    await fetch(`/api/admin/orders/${orderId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage }),
    });
    setLoading(null);
    router.refresh();
  }

  const currentIdx = STAGES.indexOf(currentStage ?? "");

  return (
    <div className="bg-white rounded-xl border border-purple-200 p-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Restoration Stage</h2>
      <p className="text-xs text-muted-foreground mb-4">Track where this order is in the restoration process.</p>

      <div className="flex flex-col gap-2">
        {STAGES.map((stage, i) => {
          const isDone = currentIdx > i;
          const isCurrent = stage === currentStage;
          const isNext = currentIdx === i - 1;

          return (
            <button
              key={stage}
              onClick={() => setStage(stage)}
              disabled={loading !== null}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg border text-sm font-medium text-left transition-colors disabled:opacity-60 ${
                isCurrent
                  ? "bg-purple-600 text-white border-purple-600"
                  : isDone
                  ? "bg-purple-50 text-purple-700 border-purple-200 line-through opacity-60"
                  : isNext
                  ? "border-purple-300 text-purple-700 hover:bg-purple-50"
                  : "border-border text-muted-foreground hover:border-purple-300 hover:text-purple-700"
              }`}
            >
              <span className={`w-6 h-6 rounded-full flex-shrink-0 flex items-center justify-center text-xs font-bold ${
                isCurrent ? "bg-white text-purple-600" : isDone ? "bg-purple-300 text-white" : "bg-border text-muted-foreground"
              }`}>
                {isDone ? "✓" : i + 1}
              </span>
              <span>{stage}</span>
              {loading === stage && <span className="ml-auto text-xs opacity-70">Saving…</span>}
              {isCurrent && <span className="ml-auto text-xs font-bold opacity-80">Current</span>}
            </button>
          );
        })}
      </div>

      {currentStage && (
        <p className="text-xs text-muted-foreground mt-4">
          Click any stage to mark it as current. Stages are logged internally (not shown to customer).
        </p>
      )}
    </div>
  );
}
