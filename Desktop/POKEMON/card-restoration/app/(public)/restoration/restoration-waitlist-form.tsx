"use client";

import { useState } from "react";

export function RestorationWaitlistForm({ onSuccess }: { onSuccess?: () => void } = {}) {
  const [form, setForm] = useState({ name: "", email: "", phone: "" });
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/restoration-waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setStatus("error"); return; }
      setStatus("success");
      if (onSuccess) setTimeout(onSuccess, 1800);
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <div className="bg-green-50 border border-green-200 rounded-xl px-6 py-5 text-center max-w-md mx-auto">
        <p className="text-green-700 font-bold text-lg mb-1">You&apos;re on the list!</p>
        <p className="text-green-600 text-sm">We&apos;ll reach out as soon as we&apos;re accepting restorations again.</p>
      </div>
    );
  }

  const inp = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white transition-colors";

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3 max-w-md mx-auto">
      <input name="name" required placeholder="Full name *" value={form.name} onChange={handleChange} className={inp} />
      <input name="email" type="email" required placeholder="Email address *" value={form.email} onChange={handleChange} className={inp} />
      <input name="phone" type="tel" placeholder="Phone number (optional)" value={form.phone} onChange={handleChange} className={inp} />
      {error && <p className="text-red-500 text-xs">{error}</p>}
      <button
        type="submit"
        disabled={status === "loading"}
        className="h-10 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {status === "loading" ? "Submitting…" : "Notify Me When Open"}
      </button>
    </form>
  );
}
