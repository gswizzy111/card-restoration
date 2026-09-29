"use client";

import { useState, useRef } from "react";
import { toast } from "sonner";
import type { TestimonialImage } from "@/lib/testimonials";

export function TestimonialsManager({ initialImages }: { initialImages: TestimonialImage[] }) {
  const [images, setImages] = useState<TestimonialImage[]>(initialImages);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  async function handleUpload(files: FileList) {
    setUploading(true);
    const uploaded: TestimonialImage[] = [];
    for (const file of Array.from(files)) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/admin/testimonials/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        uploaded.push({ id: crypto.randomUUID(), url: data.url, alt: "Customer review" });
      } else {
        toast.error(data.error ?? "Upload failed");
      }
    }
    if (uploaded.length) {
      const next = [...images, ...uploaded];
      setImages(next);
      await persist(next);
      toast.success(`${uploaded.length} photo${uploaded.length !== 1 ? "s" : ""} added`);
    }
    setUploading(false);
    if (fileRef.current) fileRef.current.value = "";
  }

  async function handleDelete(id: string) {
    const res = await fetch("/api/admin/testimonials", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    if ((await res.json()).ok) {
      setImages((prev) => prev.filter((img) => img.id !== id));
      toast.success("Removed");
    } else {
      toast.error("Failed to remove");
    }
  }

  async function move(index: number, direction: -1 | 1) {
    const next = [...images];
    const swapWith = index + direction;
    if (swapWith < 0 || swapWith >= next.length) return;
    [next[index], next[swapWith]] = [next[swapWith], next[index]];
    setImages(next);
    await persist(next);
  }

  async function persist(imgs: TestimonialImage[]) {
    setSaving(true);
    await fetch("/api/admin/testimonials", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ images: imgs }),
    });
    setSaving(false);
  }

  return (
    <div className="flex flex-col gap-6">
      {/* Upload area */}
      <div className="bg-white rounded-xl border-2 border-dashed border-border p-8 text-center">
        <p className="text-sm font-semibold text-foreground mb-1">Upload Instagram Screenshots</p>
        <p className="text-xs text-muted-foreground mb-4">
          Save photos from your Instagram highlight to your phone, then upload them here. JPEG, PNG, or WebP · max 10MB each.
        </p>
        <label className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white font-semibold text-sm rounded-lg cursor-pointer hover:bg-primary/90 transition-colors">
          {uploading ? "Uploading…" : "+ Add Photos"}
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            disabled={uploading}
            onChange={(e) => e.target.files?.length && handleUpload(e.target.files)}
          />
        </label>
      </div>

      {/* Status */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">{images.length} photo{images.length !== 1 ? "s" : ""}</p>
        {saving && <p className="text-xs text-muted-foreground">Saving…</p>}
      </div>

      {/* Grid */}
      {images.length === 0 ? (
        <div className="bg-white rounded-xl border border-border p-12 text-center text-muted-foreground text-sm">
          No photos yet. Upload screenshots from your Instagram highlight above.
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div key={img.id} className="relative group rounded-xl overflow-hidden border border-border bg-secondary">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.url}
                alt={img.alt ?? "Customer review"}
                className="w-full aspect-square object-cover"
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/40 transition-colors" />

              {/* Controls */}
              <div className="absolute top-1.5 right-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => handleDelete(img.id)}
                  className="w-7 h-7 bg-red-500 text-white rounded-full flex items-center justify-center text-xs font-bold hover:bg-red-600 shadow"
                  title="Remove"
                >×</button>
              </div>

              {/* Move buttons */}
              <div className="absolute bottom-1.5 left-1.5 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => move(i, -1)}
                  disabled={i === 0}
                  className="w-6 h-6 bg-white/90 text-foreground rounded text-xs font-bold hover:bg-white disabled:opacity-30 shadow"
                  title="Move left"
                >←</button>
                <button
                  onClick={() => move(i, 1)}
                  disabled={i === images.length - 1}
                  className="w-6 h-6 bg-white/90 text-foreground rounded text-xs font-bold hover:bg-white disabled:opacity-30 shadow"
                  title="Move right"
                >→</button>
              </div>

              {/* Position badge */}
              <div className="absolute top-1.5 left-1.5">
                <span className="text-xs font-bold bg-black/60 text-white px-1.5 py-0.5 rounded">{i + 1}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
