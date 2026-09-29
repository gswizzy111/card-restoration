"use client";

import { useState, useEffect, useCallback } from "react";

type Accountant = {
  id: string;
  name: string;
  email: string;
  password_hash: string | null;
  invite_token: string | null;
  invite_token_expires_at: string | null;
  created_at: string;
  last_login_at: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "numeric", minute: "2-digit",
  });
}

export default function AccountantAccessPage() {
  const [accountants, setAccountants] = useState<Accountant[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");
  const [revoking, setRevoking] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/accountant/list");
    if (res.ok) setAccountants(await res.json());
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setInviteError("");
    setInviteSuccess("");
    setSending(true);
    const res = await fetch("/api/admin/accountant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: name.trim(), email: email.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setInviteError(data.error ?? "Failed to send invite.");
    } else {
      setInviteSuccess(`Invite sent to ${email.trim()}.`);
      setName("");
      setEmail("");
      load();
    }
    setSending(false);
  }

  async function handleRevoke(id: string, accountantName: string) {
    if (!confirm(`Remove access for ${accountantName}?`)) return;
    setRevoking(id);
    await fetch("/api/admin/accountant", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    setRevoking(null);
    load();
  }

  async function handleResend(name: string, email: string) {
    setSending(true);
    setInviteError("");
    setInviteSuccess("");
    const res = await fetch("/api/admin/accountant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setInviteError(data.error ?? "Failed to resend.");
    else { setInviteSuccess(`Invite resent to ${email}.`); load(); }
    setSending(false);
  }

  const input = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-6 py-10">

        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Accountant Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Invite someone to view-only access — they'll get an email to set their own password.
          </p>
        </div>

        {/* Invite form */}
        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="font-heading font-black text-base text-foreground mb-4">Send an Invite</h2>
          <form onSubmit={handleInvite} className="flex flex-col gap-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Full Name</label>
                <input className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
              </div>
              <div>
                <label className="block text-xs font-semibold text-muted-foreground mb-1.5">Email Address</label>
                <input className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required />
              </div>
            </div>
            {inviteError && <p className="text-sm text-red-500">{inviteError}</p>}
            {inviteSuccess && <p className="text-sm text-green-600 font-semibold">{inviteSuccess}</p>}
            <button
              type="submit"
              disabled={sending}
              className="self-start h-10 px-5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send Invite Email →"}
            </button>
          </form>
        </div>

        {/* Current access */}
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-heading font-black text-base text-foreground">Current Access</h2>
          </div>

          {loading && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>
          )}

          {!loading && accountants.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">
              No accountants added yet. Send an invite above.
            </div>
          )}

          {!loading && accountants.map((a) => {
            const isPending = !a.password_hash;
            const tokenExpired = a.invite_token_expires_at && new Date(a.invite_token_expires_at) < new Date();
            return (
              <div key={a.id} className="px-5 py-4 border-b border-border last:border-0 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary shrink-0">
                  {a.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{a.name}</p>
                    {isPending ? (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${tokenExpired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {tokenExpired ? "Invite expired" : "Invite pending"}
                      </span>
                    ) : (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground">{a.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {isPending ? `Invite sent ${fmt(a.created_at)}` : `Last login: ${fmt(a.last_login_at)}`}
                  </p>
                </div>
                <div className="flex gap-2 shrink-0">
                  {isPending && (
                    <button
                      onClick={() => handleResend(a.name, a.email)}
                      disabled={sending}
                      className="text-xs font-bold text-primary hover:underline disabled:opacity-50"
                    >
                      Resend
                    </button>
                  )}
                  <button
                    onClick={() => handleRevoke(a.id, a.name)}
                    disabled={revoking === a.id}
                    className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline disabled:opacity-50"
                  >
                    {revoking === a.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-800 leading-relaxed">
          <strong>What can accountants see?</strong> Tax reports, P&L, sales statements, orders (view only), and customer list. They cannot update orders, send emails, purchase labels, or change any settings.
        </div>
      </div>
    </div>
  );
}
