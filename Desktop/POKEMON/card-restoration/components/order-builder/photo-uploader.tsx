"use client";

import { useRef, useState, useEffect, useCallback } from "react";
import { X } from "lucide-react";
import { toast } from "sonner";

interface PhotoUploaderProps {
  photoUrls: string[];
  onChange: (urls: string[]) => void;
  max?: number;
}

// Compress image client-side to ≤ 2000px wide, JPEG 0.85.
// Keeps files small (< 1 MB typically) so uploads are fast and well under any size cap.
// Falls back to original file if canvas fails (e.g. unsupported format on some desktops).
async function compressImage(file: File): Promise<File> {
  return new Promise((resolve) => {
    const MAX_PX = 2000;
    const img = new Image();
    const objectUrl = URL.createObjectURL(file);

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > MAX_PX) {
        height = Math.round((height * MAX_PX) / width);
        width = MAX_PX;
      }
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) { resolve(file); return; }
      ctx.drawImage(img, 0, 0, width, height);
      canvas.toBlob(
        (blob) => {
          if (blob) {
            resolve(new File([blob], file.name.replace(/\.[^.]+$/, ".jpg"), { type: "image/jpeg" }));
          } else {
            resolve(file);
          }
        },
        "image/jpeg",
        0.85
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(file); // can't decode (e.g. HEIC on desktop) — send original
    };
    img.src = objectUrl;
  });
}

async function uploadFile(file: File): Promise<string> {
  // Compress first; if compression produces a tiny result, upload directly.
  const compressed = await compressImage(file);

  // Try presigned direct-to-Supabase upload first (bypasses Netlify 6 MB body cap).
  // Fall back to regular server-side POST if presign fails.
  try {
    const presignRes = await fetch("/api/upload", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ filename: compressed.name, contentType: compressed.type }),
    });
    if (presignRes.ok) {
      const { signedUrl, publicUrl } = await presignRes.json();
      const uploadRes = await fetch(signedUrl, {
        method: "PUT",
        headers: { "Content-Type": compressed.type },
        body: compressed,
      });
      if (uploadRes.ok) return publicUrl as string;
    }
  } catch {
    // fall through to server-side POST
  }

  // Server-side POST fallback (compressed file is typically < 500 KB, well under limits)
  const fd = new FormData();
  fd.append("file", compressed);
  const res = await fetch("/api/upload", { method: "POST", body: fd });
  if (!res.ok) {
    const d = await res.json().catch(() => ({}));
    throw new Error(d.error ?? `Upload failed (${res.status})`);
  }
  const data = await res.json();
  if (!data.url) throw new Error(data.error ?? "Upload failed");
  return data.url as string;
}

export function PhotoUploader({ photoUrls, onChange, max = 4 }: PhotoUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [isInAppBrowser, setIsInAppBrowser] = useState(false);

  useEffect(() => {
    setIsInAppBrowser(/Instagram|FBAN|FBAV|FB_IAB|Twitter|TikTok/i.test(navigator.userAgent));
  }, []);

  const processFiles = useCallback(async (rawFiles: File[]) => {
    setUploadError("");
    const remaining = max - photoUrls.length;
    if (remaining <= 0) {
      toast.error(`Maximum ${max} photos per card.`);
      return;
    }
    const toUpload = rawFiles.filter((f) => !f.type || f.type.startsWith("image/")).slice(0, remaining);
    if (toUpload.length === 0) {
      const msg = "Please select image files (JPEG, PNG, HEIC, etc.)";
      setUploadError(msg);
      toast.error(msg);
      return;
    }

    setUploading(true);
    const newUrls: string[] = [];
    for (const file of toUpload) {
      try {
        const url = await uploadFile(file);
        newUrls.push(url);
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed. Please try again.";
        setUploadError(msg);
        toast.error(msg);
      }
    }
    if (newUrls.length > 0) onChange([...photoUrls, ...newUrls]);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
  }, [photoUrls, onChange, max]);

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    processFiles(Array.from(e.target.files ?? []));
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (!uploading) processFiles(Array.from(e.dataTransfer.files));
  }

  function remove(url: string) {
    onChange(photoUrls.filter((u) => u !== url));
  }

  if (isInAppBrowser) {
    return (
      <div className="bg-red-50 border-2 border-red-400 rounded-lg p-3 text-sm">
        <p className="font-black text-red-900 mb-1">📵 Photo upload blocked</p>
        <p className="text-red-800 leading-relaxed">
          Instagram&apos;s browser doesn&apos;t allow photo uploads.{" "}
          <strong>Tap ··· → &quot;Open in browser&quot;</strong> to use Safari or Chrome, then come back to this page.
        </p>
      </div>
    );
  }

  const canAddMore = photoUrls.length < max;

  return (
    <div className="flex flex-col gap-3">
      {/* Thumbnails */}
      {photoUrls.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {photoUrls.map((url) => (
            <div key={url} className="relative w-20 h-20 rounded-lg overflow-hidden border border-border group flex-shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={url} alt="" className="w-full h-full object-cover" />
              <button
                type="button"
                onClick={() => remove(url)}
                className="absolute top-1 right-1 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity shadow"
                aria-label="Remove photo"
              >
                <X className="h-3 w-3" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Upload zone */}
      {canAddMore && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Upload photos"
          onClick={() => !uploading && inputRef.current?.click()}
          onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); !uploading && inputRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); if (!uploading) setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed px-4 py-7 transition-colors select-none
            ${uploading ? "cursor-not-allowed opacity-70" : "cursor-pointer"}
            ${dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50 hover:bg-secondary/20"}
          `}
        >
          {uploading ? (
            <div className="flex flex-col items-center gap-2">
              <div className="w-8 h-8 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              <p className="text-sm font-medium text-muted-foreground">Uploading photo…</p>
            </div>
          ) : (
            <>
              <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                <svg className="w-6 h-6 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                </svg>
              </div>
              <div className="text-center">
                <p className="text-sm font-semibold text-foreground">
                  {photoUrls.length === 0 ? "Upload photos of your card" : "Add more photos"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tap to choose · Drag &amp; drop · Any photo format · Large files OK
                </p>
              </div>
              <p className="text-xs text-muted-foreground/70">
                {photoUrls.length}/{max} photo{max !== 1 ? "s" : ""}
              </p>
            </>
          )}
        </div>
      )}

      {/* Inline error banner */}
      {uploadError && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5">
          <span className="text-red-500 shrink-0 mt-px text-sm">⚠</span>
          <p className="text-xs text-red-700 font-medium flex-1">{uploadError}</p>
          <button
            type="button"
            onClick={() => setUploadError("")}
            className="text-red-400 hover:text-red-600 shrink-0"
            aria-label="Dismiss"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Hidden file input — accepts ANY image (JPEG, PNG, WEBP, HEIC, etc.) */}
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={handleInputChange}
      />
    </div>
  );
}
