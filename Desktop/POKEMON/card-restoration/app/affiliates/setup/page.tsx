"use client";

import { Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { PortalCard, PORTAL_BUTTON_CN, PORTAL_INPUT_CN, PORTAL_LABEL_CN } from "../portal-card";

const MIN = 10;

// The setup link from the admin lands here; the token is only used when the form is sent.
function Setup() {
  const router = useRouter();
  const token = useSearchParams().get("token") ?? "";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    if (password.length < MIN) return setError(`Use at least ${MIN} characters.`);
    if (password !== confirm) return setError("The two passwords don't match.");
    setSaving(true);
    const res = await fetch("/api/affiliates/setup", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setSaving(false);
      return setError(data.error ?? "Something went wrong. Please try again.");
    }
    router.push("/affiliates/dashboard");
    router.refresh();
  }

  if (!token) {
    return (
      <p className="text-sm text-muted-foreground">
        This link is incomplete. Ask The Card Doc for a new setup link, or <Link href="/affiliates" className="font-semibold text-primary hover:underline">sign in</Link>.
      </p>
    );
  }

  return (
    <form onSubmit={submit} className="flex flex-col gap-4">
      <p className="text-sm text-muted-foreground -mt-3">You&apos;ll sign in with your creator code and this password.</p>
      <div>
        <label htmlFor="setup-password" className={PORTAL_LABEL_CN}>Password</label>
        <input id="setup-password" type="password" autoComplete="new-password" minLength={MIN} required value={password} onChange={(e) => setPassword(e.target.value)} placeholder={`At least ${MIN} characters`} className={PORTAL_INPUT_CN} />
      </div>
      <div>
        <label htmlFor="setup-confirm" className={PORTAL_LABEL_CN}>Confirm Password</label>
        <input id="setup-confirm" type="password" autoComplete="new-password" minLength={MIN} required value={confirm} onChange={(e) => setConfirm(e.target.value)} className={PORTAL_INPUT_CN} />
      </div>
      {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
      <button type="submit" disabled={saving} className={PORTAL_BUTTON_CN}>{saving ? "Saving..." : "Save and open my dashboard"}</button>
    </form>
  );
}

export default function CreatorSetupPage() {
  return (
    <PortalCard title="Set your password">
      <Suspense><Setup /></Suspense>
    </PortalCard>
  );
}
