"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

export type ConfirmSent = {
  email: string;
  /** The password just typed: "Send it again" signs in with it, which sends a new link */
  password: string;
  sent: boolean;
  existingAccount?: boolean;
  sentFrom?: string;
  subject?: string;
  message?: string;
};

const COOLDOWN = 30;

/**
 * After signing up (or signing in before confirming): where the confirm email
 * went, what it looks like, where else to look, and a way to get a new one or
 * fix a mistyped address.
 */
export function CheckEmail({ info, onConfirmed, onStartOver, onBack }: {
  info: ConfirmSent;
  onConfirmed: () => void;
  onStartOver: () => void;
  onBack: () => void;
}) {
  const [state, setState] = useState(info);
  const [wait, setWait] = useState(info.sent ? COOLDOWN : 0);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [error, setError] = useState(info.sent ? "" : info.message ?? "");

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendAgain() {
    setBusy(true);
    setNote("");
    setError("");
    const res = await fetch("/api/account/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: state.email, password: state.password }),
    });
    const data = await res.json().catch(() => ({}));
    setBusy(false);
    if (res.ok) return onConfirmed(); // confirmed in the meantime: signed in
    if (data.code === "EMAIL_NOT_CONFIRMED") {
      setState((s) => ({ ...s, sent: !!data.confirmationSent, sentFrom: data.sentFrom ?? s.sentFrom, subject: data.subject ?? s.subject }));
      if (data.confirmationSent) {
        setNote("Sent. Only this newest email's button will work.");
        setWait(COOLDOWN);
      } else {
        setError(data.error ?? "We couldn't send a new link just now. Please try again in a minute.");
      }
      return;
    }
    if (res.status === 400) {
      setError("That password doesn't match the one chosen when this account was created. Sign in with that one, or reset your password.");
      return;
    }
    setError(data.error ?? "Something went wrong. Please try again.");
  }

  return (
    <div role="status" className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
      <h1 className="font-heading font-black text-2xl text-foreground text-center">Check your email</h1>

      {state.sent && (
        <p className="text-sm text-muted-foreground mt-3 leading-relaxed text-center">
          We sent a confirmation link to <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{state.email}</span>.
          Open it to confirm your email and see your orders.
        </p>
      )}

      {state.existingAccount && (
        <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-900 leading-relaxed">
          This email already has an account waiting to be confirmed. Its password is the one you chose the first time.
          Forgot it? <Link href="/account/forgot-password" className="font-semibold underline">Reset your password</Link>.
        </p>
      )}

      <ul className="mt-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
        <li>
          It comes from <span className="font-semibold text-foreground">The Card Doc</span>
          {state.sentFrom && <> (<span className="[overflow-wrap:anywhere]">{state.sentFrom}</span>)</>}
          {state.subject && <> with the subject <span className="text-foreground">&ldquo;{state.subject}&rdquo;</span></>}.
        </li>
        <li>Not there in a minute? Check your Spam, Junk and Promotions folders.</li>
        <li>Only the newest email&apos;s button works, and it expires after 1 hour.</li>
      </ul>

      {note && <p className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{note}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      <button
        type="button"
        onClick={sendAgain}
        disabled={busy || wait > 0}
        className="mt-5 w-full h-11 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
      >
        {busy ? "Sending…" : wait > 0 ? `Send it again (${wait}s)` : "Send it again"}
      </button>

      <div className="mt-4 flex flex-col items-center gap-2 text-sm">
        <button type="button" onClick={onStartOver} className="font-semibold text-primary hover:underline">
          Wrong email? Start over
        </button>
        <button type="button" onClick={onBack} className="text-muted-foreground hover:text-foreground hover:underline">
          Back to sign in
        </button>
      </div>
    </div>
  );
}
