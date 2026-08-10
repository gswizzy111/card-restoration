"use client";

import { useState, useRef } from "react";
import { X, Upload, ChevronDown, ChevronUp } from "lucide-react";

interface Card {
  id: string;
  card_name: string;
  card_set: string | null;
  card_year: string | null;
  card_number: string | null;
  estimated_value_cents: number | null;
  notes: string | null;
  photo_urls: string[];
}

interface Props {
  orderId: string;
  initialCards: Card[];
  locked: boolean;
  lockReason?: string;
}

function PhotoEditor({
  urls,
  onChange,
  disabled,
}: {
  urls: string[];
  onChange: (u: string[]) => void;
  disabled: boolean;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const MAX = 8;

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0 || disabled) return;
    const remaining = MAX - urls.length;
    if (remaining <= 0) return;
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of toUpload) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) newUrls.push(data.url);
    }
    onChange([...urls, ...newUrls]);
    setUploading(false);
  }

  return (
    <div className="flex flex-wrap gap-2 mt-1">
      {urls.map((url) => (
        <div key={url} className="relative w-14 h-14 rounded-lg overflow-hidden border border-border group">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt="" className="w-full h-full object-cover" />
          {!disabled && (
            <button
              type="button"
              onClick={() => onChange(urls.filter((u) => u !== url))}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          )}
        </div>
      ))}
      {!disabled && urls.length < MAX && (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-14 h-14 rounded-lg border-2 border-dashed border-border hover:border-primary transition-colors flex items-center justify-center text-muted-foreground hover:text-primary disabled:opacity-50"
        >
          {uploading ? <span className="text-[10px]">...</span> : <Upload className="h-4 w-4" />}
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
    </div>
  );
}

export function CardEditor({ orderId, initialCards, locked, lockReason }: Props) {
  const [cards, setCards] = useState<Card[]>(initialCards);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState(false);
  const [flash, setFlash] = useState<{ type: "success" | "error"; msg: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  function updateCard(id: string, patch: Partial<Card>) {
    setCards((prev) => prev.map((c) => (c.id === id ? { ...c, ...patch } : c)));
    setDirty(true);
  }

  async function save() {
    if (locked || saving) return;
    setSaving(true);
    setFlash(null);
    const res = await fetch(`/api/account/orders/${orderId}/cards`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cards }),
    });
    setSaving(false);
    if (res.ok) {
      setFlash({ type: "success", msg: "Changes saved successfully." });
      setDirty(false);
    } else {
      const data = await res.json().catch(() => ({}));
      setFlash({ type: "error", msg: data.error ?? "Save failed. Please try again." });
    }
  }

  if (locked) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-800">
        <p className="font-semibold mb-1">Cards locked</p>
        <p>{lockReason ?? "Your package is in transit and can no longer be edited."}</p>
        <div className="mt-3 flex flex-col gap-2">
          {cards.map((card, i) => (
            <div key={card.id} className="flex gap-2">
              <span className="text-amber-600 font-bold text-xs w-5 shrink-0 pt-0.5">{i + 1}.</span>
              <span className="font-medium text-sm">{card.card_name}</span>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="bg-blue-50 border border-blue-200 rounded-xl px-4 py-3 text-sm text-blue-800">
        You can edit your card details below until your package is picked up by the carrier.
      </div>

      {cards.map((card, i) => {
        const open = expanded[card.id] ?? false;
        return (
          <div key={card.id} className="border border-border rounded-xl overflow-hidden">
            <button
              type="button"
              onClick={() => setExpanded((prev) => ({ ...prev, [card.id]: !open }))}
              className="w-full flex items-center justify-between px-5 py-4 bg-white hover:bg-secondary/30 transition-colors text-left"
            >
              <div>
                <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground mr-2">Card {i + 1}</span>
                <span className="font-semibold text-foreground text-sm">{card.card_name || "Unnamed card"}</span>
              </div>
              {open ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
            </button>

            {open && (
              <div className="px-5 pb-5 pt-1 bg-white border-t border-border flex flex-col gap-3">
                <Field label="Card Name *">
                  <input
                    type="text"
                    value={card.card_name}
                    onChange={(e) => updateCard(card.id, { card_name: e.target.value })}
                    className="w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary"
                  />
                </Field>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Set / Edition">
                    <input
                      type="text"
                      value={card.card_set ?? ""}
                      onChange={(e) => updateCard(card.id, { card_set: e.target.value || null })}
                      className="w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </Field>
                  <Field label="Year">
                    <input
                      type="text"
                      value={card.card_year ?? ""}
                      onChange={(e) => updateCard(card.id, { card_year: e.target.value || null })}
                      className="w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary"
                    />
                  </Field>
                </div>
                <Field label="Estimated Value ($)">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    value={card.estimated_value_cents != null ? card.estimated_value_cents / 100 : ""}
                    onChange={(e) => {
                      const v = parseFloat(e.target.value);
                      updateCard(card.id, { estimated_value_cents: isNaN(v) ? null : Math.round(v * 100) });
                    }}
                    className="w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary"
                    placeholder="0"
                  />
                </Field>
                <Field label="Notes for us">
                  <textarea
                    value={card.notes ?? ""}
                    onChange={(e) => updateCard(card.id, { notes: e.target.value || null })}
                    rows={2}
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none"
                    placeholder="Any special instructions for this card…"
                  />
                </Field>
                <Field label="Photos">
                  <PhotoEditor
                    urls={card.photo_urls}
                    onChange={(urls) => updateCard(card.id, { photo_urls: urls })}
                    disabled={false}
                  />
                </Field>
              </div>
            )}
          </div>
        );
      })}

      <div className="flex items-center gap-4">
        <button
          onClick={save}
          disabled={saving || !dirty}
          className="px-6 h-10 bg-primary text-primary-foreground text-sm font-bold rounded-xl hover:bg-primary/90 disabled:opacity-40 transition-colors"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
        {flash && (
          <p className={`text-sm font-semibold ${flash.type === "success" ? "text-green-600" : "text-red-600"}`}>
            {flash.msg}
          </p>
        )}
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1.5">{label}</label>
      {children}
    </div>
  );
}
