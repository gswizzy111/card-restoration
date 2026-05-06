"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";

export function PhotoUploader({ orderId, existingPhotos }: { orderId: string; existingPhotos: string[] }) {
  const [photos, setPhotos] = useState<string[]>(existingPhotos);
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const router = useRouter();

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

    const newPhotos = [...photos, ...uploaded];
    await fetch(`/api/admin/orders/${orderId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos: newPhotos }),
    });

    setPhotos(newPhotos);
    setUploading(false);
    router.refresh();
    if (inputRef.current) inputRef.current.value = "";
  }

  async function removePhoto(url: string) {
    const newPhotos = photos.filter((p) => p !== url);
    await fetch(`/api/admin/orders/${orderId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photos: newPhotos }),
    });
    setPhotos(newPhotos);
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-4">
      {photos.length > 0 && (
        <div className="flex flex-wrap gap-3">
          {photos.map((url) => (
            <div key={url} className="relative group">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="Restoration photo" className="w-24 h-24 object-cover rounded-lg border border-border" />
              <button
                onClick={() => removePhoto(url)}
                className="absolute -top-2 -right-2 w-5 h-5 bg-red-500 text-white rounded-full text-xs hidden group-hover:flex items-center justify-center"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          onChange={handleUpload}
          className="hidden"
          id="photo-upload"
        />
        <label
          htmlFor="photo-upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg border-2 border-dashed border-border text-sm font-medium text-muted-foreground hover:border-primary hover:text-primary transition-colors cursor-pointer"
        >
          {uploading ? "Uploading..." : "+ Upload Photos"}
        </label>
      </div>
    </div>
  );
}
