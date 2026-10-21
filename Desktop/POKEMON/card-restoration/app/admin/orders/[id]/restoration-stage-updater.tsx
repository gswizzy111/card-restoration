"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardCompletionToggle } from "./card-completion-toggle";

export const STAGES = [
  "Ready for Slab Crack",
  "Humidor",
  "Humidity Press",
  "Book",
  "Heat Press",
  "Clamp Work",
  "Book with Weights",
  "Final Dry",
];

interface Card {
  id: string;
  card_name: string;
  completed: boolean;
}

export function RestorationStageUpdater({
  orderId,
  cards,
  stageByCard,
}: {
  orderId: string;
  cards: Card[];
  stageByCard: Record<string, string>;
}) {
  const [loading, setLoading] = useState<string | null>(null); // "cardId:stage"
  const router = useRouter();

  async function setStage(cardId: string, stage: string) {
    if (stageByCard[cardId] === stage) return;
    const key = `${cardId}:${stage}`;
    setLoading(key);
    await fetch(`/api/admin/orders/${orderId}/stage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ stage, card_id: cardId }),
    });
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-purple-200 p-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Restoration Stages</h2>
      <p className="text-xs text-muted-foreground mb-5">Track each card through the restoration process. Click a stage to mark it current.</p>

      <div className="flex flex-col divide-y divide-border">
        {cards.map((card) => {
          const currentStage = stageByCard[card.id] ?? null;
          const currentIdx = STAGES.indexOf(currentStage ?? "");

          return (
            <div key={card.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{card.card_name}</p>
                  {currentStage ? (
                    <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {currentStage}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">Not started</span>
                  )}
                </div>
                <CardCompletionToggle cardId={card.id} initialCompleted={card.completed} />
              </div>

              <div className="flex flex-wrap gap-1.5">
                {STAGES.map((stage, i) => {
                  const isDone = currentIdx > i;
                  const isCurrent = stage === currentStage;
                  const key = `${card.id}:${stage}`;

                  return (
                    <button
                      key={stage}
                      onClick={() => setStage(card.id, stage)}
                      disabled={loading !== null}
                      title={stage}
                      className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs font-medium transition-colors disabled:opacity-60 ${
                        isCurrent
                          ? "bg-purple-600 text-white border-purple-600"
                          : isDone
                          ? "bg-purple-50 text-purple-400 border-purple-100 line-through"
                          : "border-border text-muted-foreground hover:border-purple-400 hover:text-purple-700"
                      }`}
                    >
                      <span className={`w-4 h-4 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold ${
                        isCurrent ? "bg-white text-purple-600" : isDone ? "bg-purple-300 text-white" : "bg-muted text-muted-foreground"
                      }`}>
                        {isDone ? "✓" : i + 1}
                      </span>
                      {loading === key ? "…" : stage}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
