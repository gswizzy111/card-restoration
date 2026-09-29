"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

interface Card {
  id: string;
  card_name: string;
  card_set: string | null;
  card_year: string | null;
  estimated_value_cents: number | null;
  notes: string | null;
  photo_urls?: string[] | null;
}

function fmtValue(cents: number | null) {
  if (!cents) return "";
  return (cents / 100).toFixed(2);
}

function Changed({ original, current }: { original: string; current: string }) {
  if (!current || current === original) return null;
  return (
    <span className="text-red-600 font-semibold text-xs ml-1">
      → {current}
    </span>
  );
}

export function AdminCardEditor({ card }: { card: Card }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(card.card_name);
  const [set, setSet] = useState(card.card_set ?? "");
  const [year, setYear] = useState(card.card_year ?? "");
  const [valueStr, setValueStr] = useState(fmtValue(card.estimated_value_cents));
  const [notes, setNotes] = useState(card.notes ?? "");
  const [photos, setPhotos] = useState<string[]>(card.photo_urls ?? []);

  const origName = card.card_name;
  const origSet = card.card_set ?? "";
  const origYear = card.card_year ?? "";
  const origValue = fmtValue(card.estimated_value_cents);
  const origNotes = card.notes ?? "";

  function hasChanges() {
    return (
      name !== origName ||
      set !== origSet ||
      year !== origYear ||
      valueStr !== origValue ||
      notes !== origNotes ||
      JSON.stringify(photos) !== JSON.stringify(card.photo_urls ?? [])
    );
  }

  function handleCancel() {
    setName(origName);
    setSet(origSet);
    setYear(origYear);
    setValueStr(origValue);
    setNotes(origNotes);
    setPhotos(card.photo_urls ?? []);
    setError("");
    setOpen(false);
  }

  async function handleUploadPhotos(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const file of files) {
      const form = new FormData();
      form.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: form });
      const data = await res.json();
      if (data.url) uploaded.push(data.url);
    }
    setPhotos((prev) => [...prev, ...uploaded]);
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  function removePhoto(url: string) {
    setPhotos((prev) => prev.filter((p) => p !== url));
  }

  async function handleSave() {
    if (!name.trim()) { setError("Card name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/cards/${card.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_name: name.trim(),
          card_set: set.trim() || null,
          card_year: year.trim() || null,
          estimated_value_cents: valueStr ? Math.round(parseFloat(valueStr) * 100) : null,
          notes: notes.trim() || null,
          photo_urls: photos,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); setSaving(false); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  const inp = (changed: boolean) =>
    `w-full h-9 border rounded-lg px-3 text-sm focus:outline-none bg-white transition-colors ${
      changed
        ? "border-red-400 text-red-700 focus:border-red-500 bg-red-50"
        : "border-border focus:border-primary"
    }`;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-semibold text-primary hover:text-primary/80 transition-colors mt-1"
      >
        Edit
      </button>
    );
  }

  return (
    <div className="mt-3 rounded-xl border border-blue-200 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-blue-50 border-b border-blue-200">
        <p className="font-bold text-sm text-blue-900">Edit Card</p>
        <button onClick={handleCancel} className="text-xs text-muted-foreground hover:text-foreground transition-colors">
          Cancel
        </button>
      </div>

      {/* Two-column body */}
      <div className="grid grid-cols-2 divide-x divide-blue-100">
        {/* ORIGINAL column */}
        <div className="p-4 bg-gray-50 flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-1">Original</p>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Name</p>
            <p className="text-sm text-foreground font-medium">{origName || <span className="italic text-muted-foreground">—</span>}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Set</p>
            <p className="text-sm text-foreground">{origSet || <span className="italic text-muted-foreground">—</span>}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Year</p>
            <p className="text-sm text-foreground">{origYear || <span className="italic text-muted-foreground">—</span>}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Est. Value</p>
            <p className="text-sm text-foreground">{origValue ? `$${origValue}` : <span className="italic text-muted-foreground">—</span>}</p>
          </div>

          <div>
            <p className="text-[10px] font-semibold text-muted-foreground mb-1">Notes</p>
            <p className="text-sm text-foreground whitespace-pre-wrap">{origNotes || <span className="italic text-muted-foreground">—</span>}</p>
          </div>

          {/* Original photos */}
          {(card.photo_urls ?? []).length > 0 && (
            <div>
              <p className="text-[10px] font-semibold text-muted-foreground mb-1">Photos</p>
              <div className="flex flex-wrap gap-1.5">
                {(card.photo_urls ?? []).map((url, i) => (
                  // eslint-disable-next-line @next/next/no-img-element
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                    <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-border" />
                  </a>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* EDITED column */}
        <div className="p-4 bg-white flex flex-col gap-3">
          <p className="text-[10px] font-bold uppercase tracking-widest text-red-600 mb-1">Edited</p>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Name *</label>
            <input
              className={inp(name !== origName)}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Charizard"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Set</label>
            <input
              className={inp(set !== origSet)}
              value={set}
              onChange={(e) => setSet(e.target.value)}
              placeholder="e.g. Base Set"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Year</label>
            <input
              className={inp(year !== origYear)}
              value={year}
              onChange={(e) => setYear(e.target.value)}
              placeholder="e.g. 1999"
            />
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Est. Value ($)</label>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
              <input
                className={`${inp(valueStr !== origValue)} pl-7`}
                type="number"
                min="0"
                step="0.01"
                value={valueStr}
                onChange={(e) => setValueStr(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>

          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Notes / Description</label>
            <textarea
              className={`w-full border rounded-lg px-3 py-2 text-sm focus:outline-none resize-none transition-colors ${
                notes !== origNotes
                  ? "border-red-400 text-red-700 focus:border-red-500 bg-red-50"
                  : "border-border focus:border-primary bg-white"
              }`}
              rows={3}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Any notes about this card..."
            />
          </div>

          {/* Photo management */}
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">Photos</label>
            {photos.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mb-2">
                {photos.map((url, i) => (
                  <div key={i} className="relative group">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-border" />
                    <button
                      onClick={() => removePhoto(url)}
                      className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center leading-none"
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            )}
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              multiple
              onChange={handleUploadPhotos}
              className="hidden"
              id={`card-photo-upload-${card.id}`}
            />
            <label
              htmlFor={`card-photo-upload-${card.id}`}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed text-xs font-semibold transition-colors cursor-pointer ${
                photos.length !== (card.photo_urls ?? []).length
                  ? "border-red-300 text-red-600 bg-red-50"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {uploading ? "Uploading…" : "+ Add Photos"}
            </label>
          </div>
        </div>
      </div>

      {/* Changed summary */}
      {hasChanges() && (
        <div className="px-4 py-2 bg-red-50 border-t border-red-200 flex flex-wrap gap-x-4 gap-y-1">
          {name !== origName && <span className="text-[10px] text-red-700 font-semibold">Name changed</span>}
          {set !== origSet && <span className="text-[10px] text-red-700 font-semibold">Set changed</span>}
          {year !== origYear && <span className="text-[10px] text-red-700 font-semibold">Year changed</span>}
          {valueStr !== origValue && <span className="text-[10px] text-red-700 font-semibold">Value changed</span>}
          {notes !== origNotes && <span className="text-[10px] text-red-700 font-semibold">Notes changed</span>}
          {JSON.stringify(photos) !== JSON.stringify(card.photo_urls ?? []) && (
            <span className="text-[10px] text-red-700 font-semibold">Photos changed</span>
          )}
        </div>
      )}

      {/* Footer */}
      <div className="px-4 py-3 bg-white border-t border-blue-100 flex items-center gap-3">
        {error && <p className="text-xs text-red-500 font-medium flex-1">{error}</p>}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={handleCancel}
            className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors rounded-lg border border-border"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !hasChanges()}
            className="px-4 py-1.5 text-sm font-bold bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-40"
          >
            {saving ? "Saving…" : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
