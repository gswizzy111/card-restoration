"use client";

import { useState } from "react";

const MIN = 10;
const FIELD_CN = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
const LABEL_CN = "block text-xs font-semibold text-muted-foreground mb-1.5";
const BUTTON_CN = "self-start h-10 px-5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50";

function Result({ ok, error }: { ok: string; error: string }) {
  if (error) return <p role="alert" className="text-sm text-red-600">{error}</p>;
  if (ok) return <p role="status" className="text-sm font-semibold text-green-700">{ok}</p>;
  return null;
}

async function post(url: string, body: unknown) {
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok, data };
}

/** The email "Forgot password?" sends reset links to. */
export function RecoveryEmailForm({ initialEmail }: { initialEmail: string | null }) {
  const [saved, setSaved] = useState(initialEmail);
  const [email, setEmail] = useState(initialEmail ?? "");
  const [current, setCurrent] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    setSaving(true);
    const { ok: success, data } = await post("/api/admin/profile/email", { email: email.trim(), current_password: current });
    setSaving(false);
    if (!success) return setError(data.error ?? "Something went wrong. Please try again.");
    setSaved(data.email);
    setEmail(data.email);
    setCurrent("");
    setOk(data.sent === false
      ? "Saved, but the note to that address didn't send. Check the spelling."
      : `Saved. We sent a note to ${data.email} so you can check it arrives.`);
  }

  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
      <div>
        <h2 className="font-heading font-black text-base text-foreground">Recovery email</h2>
        <p className="text-sm text-muted-foreground mt-1">
          {saved
            ? <>If you forget your password, the reset link goes to <span className="font-semibold text-foreground [overflow-wrap:anywhere]">{saved}</span>.</>
            : "No recovery email yet. Add one so you can reset your password if you forget it."}
        </p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label htmlFor="rec-email" className={LABEL_CN}>Email</label>
          <input id="rec-email" type="email" autoComplete="email" required value={email} onChange={(e) => { setOk(""); setEmail(e.target.value); }} placeholder="you@example.com" className={FIELD_CN} />
        </div>
        <div>
          <label htmlFor="rec-current" className={LABEL_CN}>Current password</label>
          <input id="rec-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD_CN} />
        </div>
      </div>
      <Result ok={ok} error={error} />
      <button type="submit" disabled={saving} className={BUTTON_CN}>{saving ? "Saving…" : saved ? "Update email" : "Save email"}</button>
    </form>
  );
}

export function ChangePasswordForm() {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [ok, setOk] = useState("");
  const [error, setError] = useState("");

  async function save(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setOk("");
    if (next.length < MIN) return setError(`New password: use at least ${MIN} characters.`);
    if (next !== confirm) return setError("The two new passwords don't match.");
    setSaving(true);
    const { ok: success, data } = await post("/api/admin/profile/password", { current_password: current, new_password: next });
    setSaving(false);
    if (!success) return setError(data.error ?? "Something went wrong. Please try again.");
    setCurrent("");
    setNext("");
    setConfirm("");
    setOk("Password changed. Any other browser signed in as you was signed out.");
  }

  return (
    <form onSubmit={save} className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
      <h2 className="font-heading font-black text-base text-foreground">Change password</h2>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label htmlFor="pw-current" className={LABEL_CN}>Current password</label>
          <input id="pw-current" type="password" autoComplete="current-password" required value={current} onChange={(e) => setCurrent(e.target.value)} className={FIELD_CN} />
        </div>
        <div>
          <label htmlFor="pw-new" className={LABEL_CN}>New password</label>
          <input id="pw-new" type="password" autoComplete="new-password" required minLength={MIN} value={next} onChange={(e) => { setOk(""); setNext(e.target.value); }} placeholder={`At least ${MIN} characters`} className={FIELD_CN} />
        </div>
        <div>
          <label htmlFor="pw-confirm" className={LABEL_CN}>Confirm new password</label>
          <input id="pw-confirm" type="password" autoComplete="new-password" required minLength={MIN} value={confirm} onChange={(e) => setConfirm(e.target.value)} className={FIELD_CN} />
        </div>
      </div>
      <Result ok={ok} error={error} />
      <button type="submit" disabled={saving} className={BUTTON_CN}>{saving ? "Saving…" : "Change password"}</button>
    </form>
  );
}
