"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CardCompletionToggle } from "./card-completion-toggle";

import { STAGES, adminStageLabel } from "@/lib/restoration-stages";

export { STAGES };

interface Card {
  id: string;
  card_name: string;
  completed: boolean;
  round: number;
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
  const [loading, setLoading] = useState<string | null>(null); // "cardId:stage" or "cardId:round"
  const [error, setError] = useState<string | null>(null);
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

  async function startRound(cardId: string) {
    setLoading(`${cardId}:round`);
    setError(null);
    const res = await fetch(`/api/admin/cards/${cardId}/round`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Couldn't start the next round");
    setLoading(null);
    router.refresh();
  }

  return (
    <div className="bg-white rounded-xl border border-purple-200 p-6">
      <h2 className="font-heading font-black text-lg text-foreground mb-1">Restoration Stages</h2>
      <p className="text-xs text-muted-foreground mb-5">Track each card through the restoration process. Click a stage to mark it current — the customer is emailed each time.</p>
      {error && <p className="text-xs text-red-600 mb-3">{error}</p>}

      <div className="flex flex-col divide-y divide-border">
        {cards.map((card) => {
          const currentStage = stageByCard[card.id] ?? null;
          const currentIdx = (STAGES as readonly string[]).indexOf(currentStage ?? "");
          const canStartNextRound = card.completed || currentStage === STAGES[STAGES.length - 1];

          return (
            <div key={card.id} className="py-4 first:pt-0 last:pb-0">
              <div className="flex items-center justify-between gap-2 mb-3">
                <div className="flex items-center gap-2 min-w-0">
                  <p className="text-sm font-bold text-foreground truncate">{card.card_name}</p>
                  {card.round > 1 && (
                    <span className="shrink-0 text-[10px] font-bold px-2 py-0.5 rounded-full bg-purple-600 text-white">Round {card.round}</span>
                  )}
                  {currentStage ? (
                    <span className="shrink-0 text-xs font-semibold px-2 py-0.5 rounded-full bg-purple-100 text-purple-700">
                      {currentStage}
                    </span>
                  ) : (
                    <span className="shrink-0 text-xs text-muted-foreground">Not started</span>
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {canStartNextRound && (
                    <button
                      onClick={() => startRound(card.id)}
                      disabled={loading !== null}
                      className="px-2.5 py-1 rounded-lg border border-purple-300 text-xs font-bold text-purple-700 hover:bg-purple-50 disabled:opacity-50"
                    >
                      {loading === `${card.id}:round` ? "…" : `Start Round ${card.round + 1}`}
                    </button>
                  )}
                  <CardCompletionToggle key={`${card.id}:${card.round}`} cardId={card.id} initialCompleted={card.completed} />
                </div>
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
                      title={adminStageLabel(stage)}
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
                      {loading === key ? "…" : adminStageLabel(stage)}
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
