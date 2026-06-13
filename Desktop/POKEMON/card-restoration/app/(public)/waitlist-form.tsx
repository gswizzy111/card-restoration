"use client";

import { useState } from "react";

export function WaitlistForm() {
  const [email, setEmail] = useState("");
  const [status, setStatus] = useState<"idle" | "loading" | "success" | "error">("idle");
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    setStatus("loading");
    setError("");
    try {
      const res = await fetch("/api/waitlist", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong.");
        setStatus("error");
      } else {
        setStatus("success");
      }
    } catch {
      setError("Network error. Please try again.");
      setStatus("error");
    }
  }

  if (status === "success") {
    return (
      <p style={{ color: "#86efac", fontSize: "1rem", marginTop: "2rem", letterSpacing: "0.05em" }}>
        ✓ You&apos;re on the list — we&apos;ll email you when we&apos;re back.
      </p>
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ marginTop: "2.5rem", display: "flex", flexDirection: "column", alignItems: "center", gap: "0.75rem" }}>
      <p style={{ color: "#9ca3af", fontSize: "0.85rem", letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.25rem" }}>
        Get notified when we&apos;re back
      </p>
      <div style={{ display: "flex", gap: "0.5rem", width: "100%", maxWidth: "420px" }}>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="your@email.com"
          style={{
            flex: 1,
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.2)",
            borderRadius: "8px",
            padding: "0.65rem 1rem",
            color: "#fff",
            fontSize: "0.95rem",
            outline: "none",
          }}
        />
        <button
          type="submit"
          disabled={status === "loading"}
          style={{
            background: "#c0392b",
            color: "#fff",
            border: "none",
            borderRadius: "8px",
            padding: "0.65rem 1.25rem",
            fontWeight: 700,
            fontSize: "0.9rem",
            cursor: "pointer",
            opacity: status === "loading" ? 0.6 : 1,
            whiteSpace: "nowrap",
          }}
        >
          {status === "loading" ? "..." : "Notify Me"}
        </button>
      </div>
      {error && <p style={{ color: "#f87171", fontSize: "0.8rem" }}>{error}</p>}
    </form>
  );
}
