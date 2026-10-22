"use client";

import { useState } from "react";
import Link from "next/link";
import { AdminAuthCard, ADMIN_BUTTON_CN, ADMIN_INPUT_CN } from "../auth-shell";

export default function AdminForgotPasswordPage() {
  const [login, setLogin] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    const res = await fetch("/api/admin/forgot-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ login: login.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setState("idle");
      return;
    }
    setState("sent");
  }

  return (
    <AdminAuthCard>
      <h1 className="text-sm font-bold text-foreground mt-4 mb-1">Forgot your password?</h1>
      {state === "sent" ? (
        <div role="status">
          <p className="text-sm text-muted-foreground leading-relaxed">
            If <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{login.trim()}</span> has an email on file, we just sent it a link to choose a new password. The link works once and expires in 1 hour.
          </p>
          <Link href="/admin/login" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Enter your admin username, or your email if you sign in as an accountant. We&apos;ll email you a reset link. Admins get it at the recovery email saved on their Profile page.
          </p>
          <input
            type="text"
            placeholder="Username or email"
            aria-label="Username or email"
            autoComplete="username"
            autoCapitalize="none"
            spellCheck={false}
            value={login}
            onChange={(e) => setLogin(e.target.value)}
            className={ADMIN_INPUT_CN}
            autoFocus
            required
          />
          {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
          <button type="submit" disabled={state === "sending"} className={ADMIN_BUTTON_CN}>
            {state === "sending" ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/admin/login" className="text-center text-sm font-semibold text-primary hover:underline">Back to sign in</Link>
        </form>
      )}
    </AdminAuthCard>
  );
}
