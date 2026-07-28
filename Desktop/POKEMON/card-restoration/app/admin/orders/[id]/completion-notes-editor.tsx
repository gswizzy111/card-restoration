"use client";

import { useState } from "react";

type CardData = {
  card_name: string;
  card_set?: string | null;
  card_number?: string | null;
  estimated_value_cents?: number | null;
  notes?: string | null;
  tier?: string | null;
};

export function CompletionNotesEditor({
  orderId,
  existingNotes,
  cards = [],
  orderTier,
  customerNotes,
}: {
  orderId: string;
  existingNotes: string;
  cards?: CardData[];
  orderTier?: string | null;
  customerNotes?: string | null;
}) {
  const [notes, setNotes] = useState(existingNotes);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [generating, setGenerating] = useState(false);
  const [genError, setGenError] = useState("");
  const [aiContext, setAiContext] = useState("");

  async function save() {
    setSaving(true);
    setSaved(false);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ notes }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error ?? "Failed to save");
      }
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error saving");
    } finally {
      setSaving(false);
    }
  }

  async function generateWithAI() {
    setGenerating(true);
    setGenError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/generate-notes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          cards,
          order_tier: orderTier ?? null,
          customer_notes: customerNotes ?? null,
          admin_context: aiContext.trim() || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setNotes(data.notes);
      setSaved(false);
    } catch (err) {
      setGenError(err instanceof Error ? err.message : "AI generation failed");
    } finally {
      setGenerating(false);
    }
  }

  return (
    <div className="flex flex-col gap-3">
      <textarea
        value={notes}
        onChange={(e) => { setNotes(e.target.value); setSaved(false); }}
        rows={8}
        placeholder="e.g. Removed crease from top-left corner, cleaned surface with microfiber, pressed under glass overnight. Card came out 9/10."
        className="w-full rounded-lg border border-input bg-white px-3 py-2 text-sm resize-y focus:outline-none focus:border-primary font-mono"
      />
      <div className="rounded-lg border border-violet-200 bg-violet-50 p-3 flex flex-col gap-1.5">
        <label className="text-xs font-bold text-violet-700 uppercase tracking-wide">
          Additional context for AI
        </label>
        <textarea
          value={aiContext}
          onChange={(e) => setAiContext(e.target.value)}
          rows={2}
          placeholder="e.g. The crease on card 1 was too deep to fully fix but improved significantly. Card 2 had light surface scratches not mentioned by the customer — cleaned those up too."
          className="w-full rounded border border-violet-200 bg-white px-2.5 py-1.5 text-sm resize-y focus:outline-none focus:border-violet-400 placeholder:text-violet-300"
        />
        <p className="text-xs text-violet-500">Anything you type here gets sent to Claude alongside the customer's card info.</p>
      </div>

      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={save}
          disabled={saving || generating}
          className="px-4 py-1.5 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {saving ? "Saving..." : "Save Notes"}
        </button>
        <button
          onClick={generateWithAI}
          disabled={generating || saving || cards.length === 0}
          className="px-4 py-1.5 text-sm font-bold bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors disabled:opacity-50 flex items-center gap-1.5"
          title={cards.length === 0 ? "No card data available" : "Generate notes using AI based on customer card info"}
        >
          {generating ? (
            <>
              <span className="inline-block w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating…
            </>
          ) : (
            <>✨ Generate with AI</>
          )}
        </button>
        {saved && <span className="text-xs text-green-600 font-semibold">Saved ✓</span>}
        {error && <span className="text-xs text-red-600">{error}</span>}
        {genError && <span className="text-xs text-red-600">{genError}</span>}
      </div>
      {generating && (
        <p className="text-xs text-muted-foreground">Claude is writing grader notes based on the customer's card info…</p>
      )}
      {notes && notes !== existingNotes && !saved && (
        <p className="text-xs text-amber-600 font-medium">Unsaved changes — click Save Notes to keep these.</p>
      )}
    </div>
  );
}
