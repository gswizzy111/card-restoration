"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function AddCardButton({ orderId, orderTier }: { orderId: string; orderTier?: string | null }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState("");
  const [set, setSet] = useState("");
  const [year, setYear] = useState("");
  const [valueStr, setValueStr] = useState("");
  const [notes, setNotes] = useState("");
  const [photos, setPhotos] = useState<string[]>([]);

  function reset() {
    setName(""); setSet(""); setYear(""); setValueStr(""); setNotes(""); setPhotos([]);
    setError("");
  }

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
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

  async function handleSave() {
    if (!name.trim()) { setError("Card name is required."); return; }
    setSaving(true);
    setError("");
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          card_name: name.trim(),
          card_set: set.trim() || null,
          card_year: year.trim() || null,
          estimated_value_cents: valueStr ? Math.round(parseFloat(valueStr) * 100) : null,
          notes: notes.trim() || null,
          photo_urls: photos,
          tier: orderTier ?? null,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to add card."); setSaving(false); return; }
      reset();
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  const inp = "w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white transition-colors";

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="text-xs font-bold px-3 py-1.5 rounded-lg border border-dashed border-primary/40 text-primary hover:bg-primary/5 hover:border-primary transition-colors w-full mt-2"
      >
        + Add Card
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-green-200 overflow-hidden mt-2">
      <div className="flex items-center justify-between px-4 py-3 bg-green-50 border-b border-green-200">
        <p className="font-bold text-sm text-green-900">Add Card to Order</p>
        <button onClick={() => { reset(); setOpen(false); }} className="text-xs text-muted-foreground hover:text-foreground">
          Cancel
        </button>
      </div>

      <div className="p-4 bg-white flex flex-col gap-3">
        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Card Name *</label>
          <input className={inp} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Charizard Holo" autoFocus />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Set</label>
            <input className={inp} value={set} onChange={(e) => setSet(e.target.value)} placeholder="e.g. Base Set" />
          </div>
          <div>
            <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Year</label>
            <input className={inp} value={year} onChange={(e) => setYear(e.target.value)} placeholder="e.g. 1999" />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Estimated Value ($)</label>
          <div className="relative">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">$</span>
            <input
              className={`${inp} pl-7`}
              type="number" min="0" step="0.01"
              value={valueStr}
              onChange={(e) => setValueStr(e.target.value)}
              placeholder="0.00"
            />
          </div>
        </div>

        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1">Notes</label>
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary resize-none bg-white"
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Any notes about this card..."
          />
        </div>

        <div>
          <label className="text-[10px] font-semibold text-muted-foreground block mb-1.5">Photos</label>
          {photos.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2">
              {photos.map((url, i) => (
                <div key={i} className="relative group">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={url} alt="" className="w-14 h-14 object-cover rounded border border-border" />
                  <button
                    onClick={() => setPhotos((prev) => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-red-500 text-white rounded-full text-[10px] hidden group-hover:flex items-center justify-center leading-none"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple onChange={handleUpload} className="hidden" id="add-card-photo" />
          <label
            htmlFor="add-card-photo"
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border-2 border-dashed border-border text-xs font-semibold text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
          >
            {uploading ? "Uploading…" : "+ Add Photos"}
          </label>
        </div>
      </div>

      <div className="px-4 py-3 bg-white border-t border-green-100 flex items-center gap-3">
        {error && <p className="text-xs text-red-500 font-medium flex-1">{error}</p>}
        <div className="flex gap-2 ml-auto">
          <button
            onClick={() => { reset(); setOpen(false); }}
            className="px-4 py-1.5 text-sm text-muted-foreground hover:text-foreground rounded-lg border border-border"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving || !name.trim()}
            className="px-4 py-1.5 text-sm font-bold bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-40"
          >
            {saving ? "Adding…" : "Add Card"}
          </button>
        </div>
      </div>
    </div>
  );
}
