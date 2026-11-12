// The restoration stages a card moves through, in order. The admin buttons use
// these internal names; customers see the friendly name and explanation.
export const STAGES = [
  "Ready for Slab Crack",
  "Humidor",
  "Humidity Press",
  "Book",
  "Heat Press",
  "Clamp Work",
  "Book with Weights",
  "Final Dry",
] as const;

export const STAGE_INFO: Record<string, { name: string; explanation: string }> = {
  "Ready for Slab Crack": { name: "Slab cracking", explanation: "We're carefully removing your card from its graded slab." },
  "Humidor": { name: "Humidity treatment", explanation: "Your card is in a controlled humidity environment to relax the card stock." },
  "Humidity Press": { name: "Humidity press", explanation: "Your card is being gently pressed under humidity to work out bends and creases." },
  "Book": { name: "Drying", explanation: "Your card is drying." },
  "Heat Press": { name: "Heat press", explanation: "A careful heat press pass to finish flattening and surface work." },
  "Clamp Work": { name: "Clamp work", explanation: "Your card is clamped for detailed edge and corner work." },
  "Book with Weights": { name: "Weighted press", explanation: "Your card is under weights for a final flattening." },
  "Final Dry": { name: "Final drying", explanation: "Your card is drying and settling before final inspection." },
};

// What the admin stage buttons read when it differs from the internal name.
// "Book" stays the stored name so stage events already recorded still match.
const ADMIN_LABELS: Record<string, string> = { "Book": "Drying" };

/** The stage's name on the admin buttons. */
export function adminStageLabel(stage: string) {
  return ADMIN_LABELS[stage] ?? stage;
}

/** "Humidity treatment", or "Round 2 — humidity treatment" after the first round. */
export function friendlyStage(stage: string, round = 1) {
  const name = STAGE_INFO[stage]?.name ?? stage;
  return round > 1 ? `Round ${round} — ${name.charAt(0).toLowerCase()}${name.slice(1)}` : name;
}

export type StageEvent = {
  event_type: string;
  description: string | null;
  metadata?: unknown;
};

export type StageMetadata = { card_id: string; stage: string; round: number };

// Stage events before metadata existed: "Stage: <stage> [card:<card_id>]"
const LEGACY_STAGE = /^Stage: (.+?) \[card:(.+)\]$/;

/** The card, stage and round a stage_update event records. */
export function parseStageEvent(e: StageEvent): StageMetadata | null {
  if (e.event_type !== "stage_update") return null;
  const m = e.metadata as Partial<StageMetadata> | null | undefined;
  if (m?.card_id && m.stage) return { card_id: m.card_id, stage: m.stage, round: Number(m.round) || 1 };
  const legacy = LEGACY_STAGE.exec(e.description ?? "");
  return legacy ? { card_id: legacy[2], stage: legacy[1], round: 1 } : null;
}

/**
 * Each card's current stage in its current round. `events` must be newest
 * first. A card that started a new round with no stage yet has none.
 */
export function currentStages(events: StageEvent[], roundByCard: Record<string, number>) {
  const stageByCard: Record<string, string> = {};
  for (const e of events) {
    const s = parseStageEvent(e);
    if (!s || s.card_id in stageByCard) continue;
    if (s.round === (roundByCard[s.card_id] ?? 1)) stageByCard[s.card_id] = s.stage;
    else stageByCard[s.card_id] = ""; // latest event is from an earlier round
  }
  for (const id of Object.keys(stageByCard)) if (!stageByCard[id]) delete stageByCard[id];
  return stageByCard;
}
