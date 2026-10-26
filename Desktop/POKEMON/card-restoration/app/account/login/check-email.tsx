"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";

export type ConfirmSent = {
  email: string;
  /** The password just typed: "Send it again" signs in with it, which sends a new link */
  password: string;
  sent: boolean;
  sentFrom?: string;
  subject?: string;
  message?: string;
};

const COOLDOWN = 30;

/**
 * After signing up (or signing in before confirming): where the confirm email
 * went, what it looks like, where else to look, and a way to get a new one or
 * fix a mistyped address. Only the messages are live regions, so the
 * countdown on the button isn't read out every second.
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
  // The remembered password no longer opens the account: sending again can't work
  const [wrongPassword, setWrongPassword] = useState(false);
  const heading = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    heading.current?.focus();
  }, []);

  useEffect(() => {
    if (wait <= 0) return;
    const t = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(t);
  }, [wait]);

  async function sendAgain() {
    setBusy(true);
    setNote("");
    setError("");
    try {
      const res = await fetch("/api/account/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: state.email, password: state.password }),
      });
      const data = await res.json().catch(() => ({}));
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
      if (data.code === "INVALID_CREDENTIALS") {
        setWrongPassword(true);
        setError("That password doesn't match the one chosen when this account was created. Sign in with that one, or reset your password.");
        return;
      }
      setError(data.error ?? "Something went wrong. Please try again.");
    } catch {
      setError("We couldn't reach the server. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
      <h1 ref={heading} tabIndex={-1} className="font-heading font-black text-2xl text-foreground text-center outline-none">
        {state.sent ? "Check your email" : "We couldn't send your link"}
      </h1>

      <p role="status" className="text-sm text-muted-foreground mt-3 leading-relaxed text-center">
        {state.sent ? "We sent a confirmation link to " : "Your confirmation link for "}
        <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{state.email}</span>
        {state.sent ? ". Open it to confirm your email and see your orders." : " didn't go out."}
      </p>

      <ul className="mt-5 space-y-2 text-sm text-muted-foreground leading-relaxed">
        {state.sent && (
          <li>
            It comes from <span className="font-semibold text-foreground">The Card Doc</span>
            {state.sentFrom && <> (<span className="[overflow-wrap:anywhere]">{state.sentFrom}</span>)</>}
            {state.subject && <> with the subject <span className="text-foreground">&ldquo;{state.subject}&rdquo;</span></>}.
          </li>
        )}
        {state.sent && <li>Not there in a minute? Check your Spam, Junk and Promotions folders.</li>}
        <li>Only the newest email&apos;s button works, and it expires after 1 hour.</li>
        <li>
          Signed up with this email before? Its password is the one you chose then.{" "}
          <Link href="/account/forgot-password" className="font-semibold text-primary hover:underline">Forgot it?</Link>
        </li>
      </ul>

      {note && <p role="status" className="mt-4 rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{note}</p>}
      {error && <p role="alert" className="mt-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}</p>}

      {!wrongPassword && (
        <button
          type="button"
          onClick={sendAgain}
          disabled={busy || wait > 0}
          className="mt-5 w-full h-11 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-60 transition-colors"
        >
          {busy ? "Sending…" : "Send it again"}
          {!busy && wait > 0 && <span className="font-medium"> (in {wait}s)</span>}
        </button>
      )}

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
