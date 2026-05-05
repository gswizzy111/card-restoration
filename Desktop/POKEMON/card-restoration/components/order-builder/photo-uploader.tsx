"use client";

import { useRef, useState } from "react";
import { X, Upload } from "lucide-react";
import { toast } from "sonner";

interface PhotoUploaderProps {
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

export function PhotoUploader({ photoUrls, onChange, max = 4 }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = max - photoUrls.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${max} photos per card.`);
      return;
    }
    const toUpload = Array.from(files).slice(0, remaining);
    setUploading(true);
    const newUrls: string[] = [];
    for (const file of toUpload) {
      const fd = new FormData();
      fd.append("file", file);
      const res = await fetch("/api/upload", { method: "POST", body: fd });
      const data = await res.json();
      if (data.url) {
        newUrls.push(data.url);
      } else {
        toast.error(data.error ?? "Upload failed");
      }
    }
    onChange([...photoUrls, ...newUrls]);
    setUploading(false);
  }

  function remove(url: string) {
    onChange(photoUrls.filter((u) => u !== url));
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2">
        {photoUrls.map((url) => (
          <div key={url} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border group">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt="" className="w-full h-full object-cover" />
            <button
              type="button"
              onClick={() => remove(url)}
              className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity"
            >
              <X className="h-4 w-4 text-white" />
            </button>
          </div>
        ))}

        {photoUrls.length < max && (
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-accent transition-colors flex items-center justify-center text-muted-foreground hover:text-accent disabled:opacity-50"
          >
            {uploading ? (
              <span className="text-[10px]">...</span>
            ) : (
              <Upload className="h-4 w-4" />
            )}
          </button>
        )}
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        multiple
        className="hidden"
        onChange={(e) => handleFiles(e.target.files)}
      />
      <p className="text-xs text-muted-foreground">
        Optional — up to {max} photos. JPEG, PNG, or WebP, max 5MB each.
      </p>
    </div>
  );
}
