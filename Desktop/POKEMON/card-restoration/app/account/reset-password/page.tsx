"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { AuthCard, BUTTON_CN, FIELD_CN, LABEL_CN } from "../auth-card";

// The reset link lands here; the token is only used when the form is sent.
function ResetPassword() {
  const router = useRouter();
  const tokenHash = useSearchParams().get("token_hash") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < 8) return setError("Password must be at least 8 characters.");
    if (password.length > 72) return setError("Password must be at most 72 characters.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    const res = await fetch("/api/account/auth/reset", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token_hash: tokenHash, password }),
    });
    const data = await res.json().catch(() => ({}));
    setSaving(false);
    if (!res.ok) return setError(data.error ?? "Something went wrong. Please try again.");
    router.push("/account");
    router.refresh();
  }

  return (
    <AuthCard title="Choose a new password">
      {!tokenHash ? (
        <p className="text-sm text-muted-foreground">This link is incomplete. <Link href="/account/forgot-password" className="font-semibold text-primary hover:underline">Request a new reset link</Link>.</p>
      ) : (
        <form onSubmit={submit} className="flex flex-col gap-4">
          <div>
            <label htmlFor="new-password" className={LABEL_CN}>New password</label>
            <input id="new-password" type="password" autoComplete="new-password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)} placeholder="At least 8 characters" className={FIELD_CN} />
          </div>
          <div>
            <label htmlFor="confirm-password" className={LABEL_CN}>Confirm new password</label>
            <input id="confirm-password" type="password" autoComplete="new-password" required minLength={8} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD_CN} />
          </div>
          {error && (
            <p role="alert" className="text-sm text-red-700">
              {error}{" "}
              {/expired|used/i.test(error) && <Link href="/account/forgot-password" className="font-semibold underline">Request a new link</Link>}
            </p>
          )}
          <button type="submit" disabled={saving} className={BUTTON_CN}>{saving ? "Saving…" : "Save new password"}</button>
        </form>
      )}
    </AuthCard>
  );
}

export default function ResetPasswordPage() {
  return <Suspense><ResetPassword /></Suspense>;
}
