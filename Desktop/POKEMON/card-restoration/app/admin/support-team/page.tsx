"use client";

import { useState, useEffect, useCallback } from "react";

type Member = {
  id: string;
  name: string;
  email: string;
  active: boolean;
  invite_token_expires_at: string | null;
  created_at: string;
  last_login_at: string | null;
};

function fmt(iso: string | null) {
  if (!iso) return "Never";
  return new Date(iso).toLocaleDateString("en-US", {
    timeZone: "America/New_York", month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit",
  });
}

const CAN = [
  "Look up any order by order number, customer name, email or card name",
  "See the order's status, timeline, cards, restoration stage and pre-grade results",
  "See the customer's name, email, phone and shipping address",
  "See inbound and return tracking with live carrier status",
  "Answer Update Requests and support cases (emails the customer) and change a case's status",
  "Open new support cases, add internal notes to an order, resend an order confirmation email",
  "See Email Problems (emails that bounced) and mark them fixed",
];

const CANNOT = [
  "Any money: order totals, payments, refunds, discounts, coupon and gift card codes",
  "Card values, insurance amounts, signed agreements and IP addresses",
  "Dashboards, Backlog, P&L, Statement and Tax Reports",
  "Change order status, tiers, cards or addresses; buy labels; issue refunds",
  "Customers list and export, Email Blast, Products, Settings, Affiliates, Partners",
  "Internal cases, and deleting any case",
];

export default function SupportTeamPage() {
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [removing, setRemoving] = useState<string | null>(null);

  // Sets state only once the list arrives (the first render already shows "Loading…")
  const load = useCallback(() => fetch("/api/admin/support-team")
    .then(async (res) => {
      if (res.ok) setMembers(await res.json());
      else setError("Could not load the support team.");
    })
    .catch(() => setError("Could not load the support team."))
    .finally(() => setLoading(false)), []);

  useEffect(() => { load(); }, [load]);

  async function invite(inviteName: string, inviteEmail: string) {
    setError("");
    setSuccess("");
    setSending(true);
    const res = await fetch("/api/admin/support-team", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: inviteName.trim(), email: inviteEmail.trim() }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) setError(data.error ?? "Failed to send the invite.");
    else {
      setSuccess(`Invite sent to ${inviteEmail.trim()}.`);
      setName("");
      setEmail("");
    }
    setSending(false);
    load();
  }

  async function remove(m: Member) {
    if (!confirm(`Remove support access for ${m.name}? They'll be signed out right away.`)) return;
    setRemoving(m.id);
    const res = await fetch("/api/admin/support-team", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: m.id }),
    });
    if (!res.ok) setError("Could not remove them. Please try again.");
    setRemoving(null);
    load();
  }

  const input = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-3xl mx-auto px-4 sm:px-6 py-10">
        <div className="mb-8">
          <h1 className="font-heading font-black text-3xl text-foreground">Support Access</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Give your customer support team their own logins. Each person gets an email to set a password, then signs in on the admin login under <strong>Support</strong>.
          </p>
        </div>

        <div className="bg-white rounded-xl border border-border p-6 mb-6">
          <h2 className="font-heading font-black text-base text-foreground mb-4">Invite someone</h2>
          <form onSubmit={(e) => { e.preventDefault(); invite(name, email); }} className="flex flex-col gap-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label htmlFor="sname" className="block text-xs font-semibold text-muted-foreground mb-1.5">Full Name</label>
                <input id="sname" className={input} value={name} onChange={(e) => setName(e.target.value)} placeholder="Jane Smith" required />
              </div>
              <div>
                <label htmlFor="semail" className="block text-xs font-semibold text-muted-foreground mb-1.5">Email Address</label>
                <input id="semail" className={input} type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="jane@example.com" required />
              </div>
            </div>
            {error && <p className="text-sm text-red-500">{error}</p>}
            {success && <p className="text-sm text-green-600 font-semibold">{success}</p>}
            <button
              type="submit"
              disabled={sending}
              className="self-start h-10 px-5 bg-primary text-white text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50"
            >
              {sending ? "Sending…" : "Send Invite Email →"}
            </button>
          </form>
        </div>

        <div className="bg-white rounded-xl border border-border overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border">
            <h2 className="font-heading font-black text-base text-foreground">Support team</h2>
          </div>
          {loading && <div className="px-5 py-10 text-center text-sm text-muted-foreground">Loading…</div>}
          {!loading && members.length === 0 && (
            <div className="px-5 py-10 text-center text-sm text-muted-foreground">No one yet. Send an invite above.</div>
          )}
          {!loading && members.map((m) => {
            const expired = !m.active && m.invite_token_expires_at && new Date(m.invite_token_expires_at) < new Date();
            return (
              <div key={m.id} className="px-5 py-4 border-b border-border last:border-0 flex items-center gap-4">
                <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-sm font-black text-primary shrink-0">
                  {m.name.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-semibold text-sm text-foreground">{m.name}</p>
                    {m.active ? (
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-green-100 text-green-700">Active</span>
                    ) : (
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${expired ? "bg-red-100 text-red-700" : "bg-amber-100 text-amber-700"}`}>
                        {expired ? "Invite expired" : "Invite pending"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground truncate">{m.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {m.active ? `Last login: ${fmt(m.last_login_at)}` : `Invited ${fmt(m.created_at)}`}
                  </p>
                </div>
                <div className="flex gap-3 shrink-0">
                  {!m.active && (
                    <button onClick={() => invite(m.name, m.email)} disabled={sending} className="text-xs font-bold text-primary hover:underline disabled:opacity-50">
                      Resend
                    </button>
                  )}
                  <button onClick={() => remove(m)} disabled={removing === m.id} className="text-xs font-bold text-red-500 hover:text-red-700 hover:underline disabled:opacity-50">
                    {removing === m.id ? "Removing…" : "Remove"}
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="bg-green-50 border border-green-200 rounded-xl p-4 text-xs text-green-900 leading-relaxed">
            <p className="font-bold mb-2">Support can</p>
            <ul className="list-disc pl-4 flex flex-col gap-1">{CAN.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-xs text-amber-900 leading-relaxed">
            <p className="font-bold mb-2">Support can&apos;t see or do</p>
            <ul className="list-disc pl-4 flex flex-col gap-1">{CANNOT.map((c) => <li key={c}>{c}</li>)}</ul>
          </div>
        </div>
        <p className="text-xs text-muted-foreground mt-4">
          Every case reply and order note a support member writes is signed with their name, so you can review their answers while they train.
        </p>
      </div>
    </div>
  );
}
