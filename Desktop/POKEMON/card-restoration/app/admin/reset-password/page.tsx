"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { AdminAuthCard, ADMIN_BUTTON_CN, ADMIN_INPUT_CN } from "../auth-shell";

const MIN = 10;

// The reset link lands here; the token is only used when the form is sent.
function ResetPassword() {
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    const res = await fetch("/api/admin/reset-password", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong. Please try again.");
    setDone(true);
  }

  if (done) {
    return (
      <div role="status">
        <h1 className="text-sm font-bold text-foreground mt-4 mb-1">Password changed</h1>
        <p className="text-sm text-muted-foreground leading-relaxed mb-6">You&apos;re signed out everywhere. Sign in with your new password.</p>
        <Link href="/admin/login" className={`${ADMIN_BUTTON_CN} flex items-center justify-center`}>Sign in</Link>
      </div>
    );
  }

  return (
    <>
      <h1 className="text-sm font-bold text-foreground mt-4 mb-1">Choose a new password</h1>
      {!token ? (
        <p className="text-sm text-muted-foreground">This link is incomplete. <Link href="/admin/forgot-password" className="font-semibold text-primary hover:underline">Request a new reset link</Link>.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4 mt-3">
          <input
            type="password"
            placeholder={`New password (at least ${MIN} characters)`}
            aria-label="New password"
            autoComplete="new-password"
            minLength={MIN}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={ADMIN_INPUT_CN}
            autoFocus
            required
          />
          <input
            type="password"
            placeholder="Confirm new password"
            aria-label="Confirm new password"
            autoComplete="new-password"
            minLength={MIN}
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            className={ADMIN_INPUT_CN}
            required
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}{" "}
              {/expired|used/i.test(error) && <Link href="/admin/forgot-password" className="font-semibold underline">Request a new link</Link>}
            </p>
          )}
          <button type="submit" disabled={saving} className={ADMIN_BUTTON_CN}>{saving ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <AdminAuthCard>
      <Suspense><ResetPassword /></Suspense>
    </AdminAuthCard>
  );
}
