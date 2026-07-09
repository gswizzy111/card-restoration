"use client";

import { useState, useEffect, useCallback } from "react";

type InternalCase = {
  id: string;
  title: string;
  notes: string | null;
  status: "open" | "resolved";
  due_date: string | null;
  created_at: string;
};

type SupportCase = {
  id: string;
  customer_name: string;
  customer_email: string;
  subject: string;
  status: "open" | "in_progress" | "resolved";
  notes: string | null;
  created_at: string;
  updated_at: string;
};

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// ─── New Case Modal ───────────────────────────────────────────────────────────

function NewCaseModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [type, setType] = useState<"internal" | "support">("internal");
  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [subject, setSubject] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    if (type === "internal") {
      const res = await fetch("/api/admin/cases/internal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ title, notes, due_date: dueDate || null }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error"); setSaving(false); return; }
    } else {
      const res = await fetch("/api/admin/cases/support", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ customer_name: customerName, customer_email: customerEmail, subject, notes }),
      });
      const json = await res.json();
      if (!res.ok) { setError(json.error ?? "Error"); setSaving(false); return; }
    }
    setSaving(false);
    onCreated();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 z-10">
        <h2 className="font-heading font-black text-xl text-foreground mb-4">New Case</h2>

        {/* Type toggle */}
        <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-5">
          {(["internal", "support"] as const).map(t => (
            <button key={t} onClick={() => setType(t)}
              className={`flex-1 py-2 rounded-lg text-sm font-semibold transition-all ${type === t ? "bg-white text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}>
              {t === "internal" ? "Internal Reminder" : "Support Case"}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          {type === "internal" ? (
            <>
              <input value={title} onChange={e => setTitle(e.target.value)} placeholder="Title *" required
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes (optional)" rows={3}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              <div>
                <label className="text-xs font-semibold text-muted-foreground block mb-1">Due date (optional)</label>
                <input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)}
                  className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
            </>
          ) : (
            <>
              <div className="grid grid-cols-2 gap-3">
                <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="Customer name *" required
                  className="border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
                <input type="email" value={customerEmail} onChange={e => setCustomerEmail(e.target.value)} placeholder="Email *" required
                  className="border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              </div>
              <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Subject *" required
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30" />
              <textarea value={notes} onChange={e => setNotes(e.target.value)} placeholder="Notes for customer (optional)" rows={3}
                className="w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none" />
              <p className="text-xs text-muted-foreground">Customer will receive an email with this case reference.</p>
            </>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2 mt-1">
            <button type="submit" disabled={saving}
              className="flex-1 py-2.5 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : type === "internal" ? "Add Reminder" : "Open Case & Email Customer"}
            </button>
            <button type="button" onClick={onClose}
              className="px-4 py-2.5 text-sm text-muted-foreground hover:text-foreground border border-border rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ─── Post-it Card: Internal ───────────────────────────────────────────────────

function InternalPostIt({ c, onResolve, onDelete }: { c: InternalCase; onResolve: () => void; onDelete: () => void }) {
  const [checking, setChecking] = useState(false);

  async function check() {
    setChecking(true);
    await fetch("/api/admin/cases/internal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status: "resolved" }),
    });
    onResolve();
  }

  async function del() {
    await fetch("/api/admin/cases/internal", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id }),
    });
    onDelete();
  }

  const isOverdue = c.due_date && new Date(c.due_date) < new Date();

  return (
    <div className="relative bg-[#fef08a] rounded-sm shadow-md hover:shadow-lg transition-shadow duration-200 p-5 flex flex-col gap-3 min-h-[200px]"
      style={{ transform: `rotate(${(parseInt(c.id[0], 16) % 5) - 2}deg)` }}>
      {/* Delete */}
      <button onClick={del} className="absolute top-3 right-3 text-yellow-700/50 hover:text-red-500 transition-colors text-lg leading-none font-bold">×</button>

      {/* Label */}
      <div className="flex items-center gap-1.5">
        <span className="text-[10px] font-black uppercase tracking-widest text-yellow-700/60">Reminder</span>
      </div>

      {/* Title */}
      <p className="font-heading font-black text-gray-800 text-lg leading-tight pr-4">{c.title}</p>

      {/* Notes */}
      {c.notes && <p className="text-sm text-gray-700 leading-relaxed flex-1">{c.notes}</p>}

      {/* Footer */}
      <div className="flex items-center justify-between mt-auto pt-2">
        <div className="flex flex-col gap-0.5">
          <span className="text-xs text-yellow-700/60">{fmtDate(c.created_at)}</span>
          {c.due_date && (
            <span className={`text-xs font-bold ${isOverdue ? "text-red-600" : "text-yellow-800"}`}>
              Due {fmtDate(c.due_date)}{isOverdue ? " — OVERDUE" : ""}
            </span>
          )}
        </div>
        <button onClick={check} disabled={checking}
          className="w-8 h-8 rounded-full border-2 border-yellow-700/40 hover:border-green-600 hover:bg-green-100 flex items-center justify-center transition-all disabled:opacity-50">
          {checking
            ? <div className="w-3 h-3 border-2 border-green-500 border-t-transparent rounded-full animate-spin" />
            : <svg className="w-4 h-4 text-yellow-700/40 hover:text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" /></svg>
          }
        </button>
      </div>
    </div>
  );
}

// ─── Post-it Card: Support ────────────────────────────────────────────────────

const SUPPORT_COLORS: Record<string, string> = {
  open: "bg-[#bfdbfe]",
  in_progress: "bg-[#fde68a]",
  resolved: "bg-[#bbf7d0]",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function SupportPostIt({ c, onUpdate }: { c: SupportCase; onUpdate: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const [editNotes, setEditNotes] = useState(c.notes ?? "");
  const [editStatus, setEditStatus] = useState(c.status);
  const [saving, setSaving] = useState(false);

  async function save() {
    setSaving(true);
    await fetch("/api/admin/cases/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, notes: editNotes || null, status: editStatus }),
    });
    setSaving(false);
    setExpanded(false);
    onUpdate();
  }

  const bg = SUPPORT_COLORS[c.status] ?? "bg-[#bfdbfe]";

  return (
    <div className={`relative ${bg} rounded-sm shadow-md hover:shadow-lg transition-shadow duration-200 p-5 flex flex-col gap-3 min-h-[200px]`}
      style={{ transform: `rotate(${(parseInt(c.id[1], 16) % 5) - 2}deg)` }}>

      {/* Label + case ref */}
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-black uppercase tracking-widest text-blue-900/50">Support · CASE-{shortId(c.id)}</span>
        <span className={`text-[10px] font-black uppercase tracking-widest px-2 py-0.5 rounded-full ${
          c.status === "open" ? "bg-blue-200 text-blue-800" :
          c.status === "in_progress" ? "bg-yellow-200 text-yellow-800" :
          "bg-green-200 text-green-800"
        }`}>{STATUS_LABELS[c.status]}</span>
      </div>

      {/* Subject */}
      <p className="font-heading font-black text-gray-800 text-lg leading-tight">{c.subject}</p>

      {/* Customer */}
      <p className="text-sm font-semibold text-gray-700">{c.customer_name}</p>
      <p className="text-xs text-gray-500 -mt-2">{c.customer_email}</p>

      {/* Notes preview */}
      {c.notes && !expanded && (
        <p className="text-sm text-gray-700 leading-relaxed flex-1 line-clamp-2">{c.notes}</p>
      )}

      {/* Expanded edit */}
      {expanded && (
        <div className="flex flex-col gap-2 mt-1">
          <div className="flex gap-1.5 flex-wrap">
            {(["open", "in_progress", "resolved"] as const).map(s => (
              <button key={s} onClick={() => setEditStatus(s)}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-full border-2 transition-all ${
                  editStatus === s ? "border-gray-700 bg-gray-700 text-white" : "border-gray-400 text-gray-700 hover:border-gray-600"
                }`}>
                {STATUS_LABELS[s]}
              </button>
            ))}
          </div>
          <textarea value={editNotes} onChange={e => setEditNotes(e.target.value)} rows={3} placeholder="Notes for customer…"
            className="w-full bg-white/60 border border-gray-300 rounded-lg px-2.5 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-gray-400/40 resize-none" />
          <div className="flex gap-2">
            <button onClick={save} disabled={saving}
              className="flex-1 py-1.5 bg-gray-800 text-white text-xs font-bold rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save & Email"}
            </button>
            <button onClick={() => setExpanded(false)}
              className="px-3 py-1.5 text-xs text-gray-600 hover:text-gray-800 border border-gray-300 rounded-lg transition-colors">
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      {!expanded && (
        <div className="flex items-center justify-between mt-auto pt-2">
          <span className="text-xs text-blue-900/40">{fmtDate(c.created_at)}</span>
          <button onClick={() => setExpanded(true)}
            className="text-xs font-bold text-gray-600 hover:text-gray-900 underline transition-colors">
            Update
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const [internal, setInternal] = useState<InternalCase[]>([]);
  const [support, setSupport] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [showResolved, setShowResolved] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [ir, sr] = await Promise.all([
      fetch("/api/admin/cases/internal").then(r => r.json()),
      fetch("/api/admin/cases/support").then(r => r.json()),
    ]);
    setInternal(ir.cases ?? []);
    setSupport(sr.cases ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  const openInternal = internal.filter(c => c.status === "open");
  const resolvedInternal = internal.filter(c => c.status === "resolved");
  const openSupport = support.filter(c => c.status !== "resolved");
  const resolvedSupport = support.filter(c => c.status === "resolved");

  const totalOpen = openInternal.length + openSupport.length;

  return (
    <div className="min-h-screen bg-[#f5f0e8] px-6 md:px-10 py-10">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="font-heading font-black text-4xl text-gray-800">Cases</h1>
          <p className="text-gray-500 text-sm mt-1">
            {loading ? "Loading…" : `${totalOpen} open · ${resolvedInternal.length + resolvedSupport.length} resolved`}
          </p>
        </div>
        <button onClick={() => setShowModal(true)}
          className="px-5 py-3 bg-gray-800 text-white font-bold rounded-xl hover:bg-gray-700 transition-colors shadow-md text-sm">
          + New Case
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-24"><div className="w-8 h-8 border-2 border-gray-400 border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <>
          {/* Open board */}
          {totalOpen === 0 ? (
            <div className="text-center py-24">
              <p className="text-5xl mb-4">✅</p>
              <p className="font-heading font-black text-2xl text-gray-700">All clear!</p>
              <p className="text-gray-500 text-sm mt-2">No open cases or reminders.</p>
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 space-y-5">
              {/* Internal first */}
              {openInternal.map(c => (
                <div key={c.id} className="break-inside-avoid">
                  <InternalPostIt c={c} onResolve={load} onDelete={load} />
                </div>
              ))}
              {/* Support cases */}
              {openSupport.map(c => (
                <div key={c.id} className="break-inside-avoid">
                  <SupportPostIt c={c} onUpdate={load} />
                </div>
              ))}
            </div>
          )}

          {/* Resolved section */}
          {(resolvedInternal.length > 0 || resolvedSupport.length > 0) && (
            <div className="mt-12">
              <button onClick={() => setShowResolved(!showResolved)}
                className="flex items-center gap-2 text-sm font-semibold text-gray-500 hover:text-gray-700 transition-colors mb-4">
                <span>{showResolved ? "▾" : "▸"}</span>
                {resolvedInternal.length + resolvedSupport.length} resolved cases
              </button>

              {showResolved && (
                <div className="columns-1 sm:columns-2 lg:columns-3 xl:columns-4 gap-5 space-y-5 opacity-50">
                  {resolvedInternal.map(c => (
                    <div key={c.id} className="break-inside-avoid">
                      <div className="bg-gray-200 rounded-sm shadow p-5 min-h-[120px] relative">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2">Reminder · Done</span>
                        <p className="font-heading font-black text-gray-600 text-lg line-through">{c.title}</p>
                        <p className="text-xs text-gray-400 mt-2">{fmtDate(c.created_at)}</p>
                      </div>
                    </div>
                  ))}
                  {resolvedSupport.map(c => (
                    <div key={c.id} className="break-inside-avoid">
                      <div className="bg-gray-200 rounded-sm shadow p-5 min-h-[120px]">
                        <span className="text-[10px] font-black uppercase tracking-widest text-gray-500 block mb-2">Support · Resolved</span>
                        <p className="font-heading font-black text-gray-600 text-base line-through">{c.subject}</p>
                        <p className="text-xs text-gray-500 mt-1">{c.customer_name}</p>
                        <p className="text-xs text-gray-400 mt-2">{fmtDate(c.created_at)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {showModal && <NewCaseModal onClose={() => setShowModal(false)} onCreated={load} />}
    </div>
  );
}
