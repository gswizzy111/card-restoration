"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { Search, X } from "lucide-react";

export function CardSearch() {
  const router = useRouter();
  const params = useSearchParams();
  const [value, setValue] = useState(params.get("q") ?? "");

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const q = value.trim();
    router.push(q ? `/admin?q=${encodeURIComponent(q)}` : "/admin");
  }

  function clear() {
    setValue("");
    router.push("/admin");
  }

  return (
    <form onSubmit={submit} className="flex items-center gap-2 w-full max-w-sm">
      <div className="relative flex-1">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="Search by card name…"
          className="w-full h-9 pl-9 pr-8 rounded-lg border border-border bg-white text-sm outline-none focus:border-primary transition-colors"
        />
        {value && (
          <button
            type="button"
            onClick={clear}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>
      <button
        type="submit"
        className="h-9 px-4 bg-primary text-primary-foreground text-sm font-semibold rounded-lg hover:opacity-90 transition-opacity"
      >
        Search
      </button>
    </form>
  );
}
