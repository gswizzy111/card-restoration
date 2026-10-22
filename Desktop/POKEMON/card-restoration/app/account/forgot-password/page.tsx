"use client";

import { useState } from "react";
import Link from "next/link";
import { AuthCard, BUTTON_CN, FIELD_CN, LABEL_CN } from "../auth-card";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [state, setState] = useState<"idle" | "sending" | "sent">("idle");
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setState("sending");
    const res = await fetch("/api/account/auth/forgot", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email }),
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
    <AuthCard title="Reset your password">
      {state === "sent" ? (
        <div role="status">
          <p className="text-sm text-muted-foreground leading-relaxed">
            If there&apos;s an account for <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{email}</span>, we just emailed it a link to choose a new password. The link expires in 1 hour.
          </p>
          <Link href="/account/login" className="mt-6 inline-block text-sm font-semibold text-primary hover:underline">Back to sign in</Link>
        </div>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <p className="text-sm text-muted-foreground">Enter the email on your account and we&apos;ll send you a reset link.</p>
          <div>
            <label htmlFor="forgot-email" className={LABEL_CN}>Email</label>
            <input id="forgot-email" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@example.com" className={FIELD_CN} />
          </div>
          {error && <p role="alert" className="text-sm text-red-700">{error}</p>}
          <button type="submit" disabled={state === "sending"} className={BUTTON_CN}>
            {state === "sending" ? "Sending…" : "Send reset link"}
          </button>
          <Link href="/account/login" className="text-center text-sm font-semibold text-primary hover:underline">Back to sign in</Link>
        </form>
      )}
    </AuthCard>
  );
}
