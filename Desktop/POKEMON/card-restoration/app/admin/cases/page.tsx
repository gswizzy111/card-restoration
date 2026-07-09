"use client";

import { useState, useEffect, useCallback } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

const STATUS_COLORS: Record<string, string> = {
  open:        "bg-blue-100 text-blue-700",
  in_progress: "bg-yellow-100 text-yellow-700",
  resolved:    "bg-green-100 text-green-700",
};

const STATUS_LABELS: Record<string, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${STATUS_COLORS[status] ?? "bg-secondary text-muted-foreground"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

// ─── Internal Cases Tab ───────────────────────────────────────────────────────

function InternalTab() {
  const [cases, setCases] = useState<InternalCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [title, setTitle] = useState("");
  const [notes, setNotes] = useState("");
  const [dueDate, setDueDate] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editNotes, setEditNotes] = useState<Record<string, string>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/cases/internal");
    const json = await res.json();
    setCases(json.cases ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) return;
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/cases/internal", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title, notes, due_date: dueDate || null }),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Error"); setSaving(false); return; }
    setTitle(""); setNotes(""); setDueDate(""); setCreating(false);
    setSaving(false);
    load();
  }

  async function toggleStatus(c: InternalCase) {
    const newStatus = c.status === "open" ? "resolved" : "open";
    setUpdating(c.id);
    await fetch("/api/admin/cases/internal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, status: newStatus }),
    });
    setUpdating(null);
    load();
  }

  async function saveNotes(c: InternalCase) {
    setUpdating(c.id);
    await fetch("/api/admin/cases/internal", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, notes: editNotes[c.id] ?? c.notes }),
    });
    setUpdating(null);
    load();
  }

  async function deleteCase(id: string) {
    if (!confirm("Delete this reminder?")) return;
    await fetch("/api/admin/cases/internal", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
    load();
  }

  const open = cases.filter(c => c.status === "open");
  const resolved = cases.filter(c => c.status === "resolved");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading font-black text-xl text-foreground">Internal Reminders</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Private notes and to-dos for your team.</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
        >
          + New Reminder
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="bg-white border border-border rounded-xl p-5 mb-6 flex flex-col gap-3">
          <input
            value={title}
            onChange={e => setTitle(e.target.value)}
            placeholder="Title *"
            required
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
          />
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            placeholder="Notes (optional)"
            rows={3}
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
          />
          <div className="flex items-center gap-3">
            <div className="flex-1">
              <label className="text-xs text-muted-foreground font-medium block mb-1">Due date (optional)</label>
              <input
                type="date"
                value={dueDate}
                onChange={e => setDueDate(e.target.value)}
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Saving…" : "Save Reminder"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {open.length === 0 && !creating && (
            <div className="text-center py-12 text-muted-foreground text-sm">No open reminders. Click + New Reminder to add one.</div>
          )}
          {open.map(c => (
            <div key={c.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-3 px-5 py-4">
                <button
                  onClick={() => toggleStatus(c)}
                  disabled={updating === c.id}
                  className="w-5 h-5 rounded-full border-2 border-border hover:border-primary transition-colors flex-shrink-0"
                  title="Mark resolved"
                />
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm text-foreground leading-tight">{c.title}</p>
                  {c.due_date && (
                    <p className="text-xs text-muted-foreground mt-0.5">Due {fmtDate(c.due_date)}</p>
                  )}
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(c.created_at)}</span>
                <button
                  onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  className="text-xs text-primary font-semibold hover:underline flex-shrink-0"
                >
                  {expanded === c.id ? "Hide" : "Details"}
                </button>
                <button
                  onClick={() => deleteCase(c.id)}
                  className="text-muted-foreground hover:text-red-500 transition-colors flex-shrink-0 text-lg leading-none"
                  title="Delete"
                >
                  ×
                </button>
              </div>
              {expanded === c.id && (
                <div className="border-t border-border px-5 py-4 bg-secondary/30 flex flex-col gap-3">
                  <textarea
                    value={editNotes[c.id] ?? (c.notes ?? "")}
                    onChange={e => setEditNotes(prev => ({ ...prev, [c.id]: e.target.value }))}
                    rows={3}
                    placeholder="Notes…"
                    className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-white"
                  />
                  <button
                    onClick={() => saveNotes(c)}
                    disabled={updating === c.id}
                    className="self-start px-3 py-1.5 bg-primary text-primary-foreground text-xs font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    {updating === c.id ? "Saving…" : "Save Notes"}
                  </button>
                </div>
              )}
            </div>
          ))}

          {resolved.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-muted-foreground font-medium cursor-pointer hover:text-foreground">
                {resolved.length} resolved reminder{resolved.length !== 1 ? "s" : ""}
              </summary>
              <div className="flex flex-col gap-2 mt-3">
                {resolved.map(c => (
                  <div key={c.id} className="bg-white border border-border rounded-xl px-5 py-3 flex items-center gap-3 opacity-60">
                    <button onClick={() => toggleStatus(c)} className="w-5 h-5 rounded-full bg-green-400 border-2 border-green-400 flex-shrink-0" title="Reopen" />
                    <p className="flex-1 text-sm line-through text-muted-foreground">{c.title}</p>
                    <button onClick={() => deleteCase(c.id)} className="text-muted-foreground hover:text-red-500 transition-colors text-lg leading-none">×</button>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Support Cases Tab ────────────────────────────────────────────────────────

function SupportTab() {
  const [cases, setCases] = useState<SupportCase[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);

  const [form, setForm] = useState({ customer_name: "", customer_email: "", subject: "", notes: "" });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [editState, setEditState] = useState<Record<string, { notes: string; status: string }>>({});
  const [updating, setUpdating] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await fetch("/api/admin/cases/support");
    const json = await res.json();
    setCases(json.cases ?? []);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  function initEdit(c: SupportCase) {
    if (!editState[c.id]) {
      setEditState(prev => ({ ...prev, [c.id]: { notes: c.notes ?? "", status: c.status } }));
    }
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError("");
    const res = await fetch("/api/admin/cases/support", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    const json = await res.json();
    if (!res.ok) { setError(json.error ?? "Error"); setSaving(false); return; }
    setForm({ customer_name: "", customer_email: "", subject: "", notes: "" });
    setCreating(false);
    setSaving(false);
    load();
  }

  async function handleUpdate(c: SupportCase) {
    const state = editState[c.id];
    if (!state) return;
    setUpdating(c.id);
    await fetch("/api/admin/cases/support", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: c.id, notes: state.notes || null, status: state.status }),
    });
    setUpdating(null);
    load();
  }

  const active = cases.filter(c => c.status !== "resolved");
  const resolved = cases.filter(c => c.status === "resolved");

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="font-heading font-black text-xl text-foreground">Support Cases</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Open a case for a customer — they get email updates automatically.</p>
        </div>
        <button
          onClick={() => setCreating(!creating)}
          className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 transition-colors"
        >
          + Open Case
        </button>
      </div>

      {/* Create form */}
      {creating && (
        <form onSubmit={handleCreate} className="bg-white border border-border rounded-xl p-5 mb-6 flex flex-col gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Customer Name *</label>
              <input
                value={form.customer_name}
                onChange={e => setForm(p => ({ ...p, customer_name: e.target.value }))}
                placeholder="John Smith"
                required
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-muted-foreground block mb-1">Customer Email *</label>
              <input
                type="email"
                value={form.customer_email}
                onChange={e => setForm(p => ({ ...p, customer_email: e.target.value }))}
                placeholder="john@example.com"
                required
                className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Subject *</label>
            <input
              value={form.subject}
              onChange={e => setForm(p => ({ ...p, subject: e.target.value }))}
              placeholder="e.g. Card damaged in transit"
              required
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-muted-foreground block mb-1">Initial notes (included in customer email)</label>
            <textarea
              value={form.notes}
              onChange={e => setForm(p => ({ ...p, notes: e.target.value }))}
              placeholder="Describe the issue or what we're doing about it…"
              rows={3}
              className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <p className="text-xs text-muted-foreground">Opening this case will send an email to the customer with the case reference and notes.</p>
          <div className="flex gap-2">
            <button type="submit" disabled={saving} className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors">
              {saving ? "Opening case…" : "Open Case & Email Customer"}
            </button>
            <button type="button" onClick={() => setCreating(false)} className="px-4 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors">
              Cancel
            </button>
          </div>
        </form>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" /></div>
      ) : (
        <div className="flex flex-col gap-3">
          {active.length === 0 && !creating && (
            <div className="text-center py-12 text-muted-foreground text-sm">No active support cases.</div>
          )}

          {active.map(c => (
            <div key={c.id} className="bg-white border border-border rounded-xl overflow-hidden">
              <div className="flex items-center gap-4 px-5 py-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-mono text-xs text-muted-foreground">CASE-{shortId(c.id)}</span>
                    <StatusBadge status={c.status} />
                  </div>
                  <p className="font-semibold text-sm text-foreground mt-1 leading-tight">{c.subject}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{c.customer_name} · {c.customer_email}</p>
                </div>
                <span className="text-xs text-muted-foreground flex-shrink-0">{fmtDate(c.created_at)}</span>
                <button
                  onClick={() => { setExpanded(expanded === c.id ? null : c.id); initEdit(c); }}
                  className="text-xs text-primary font-semibold hover:underline flex-shrink-0"
                >
                  {expanded === c.id ? "Close" : "Manage"}
                </button>
              </div>

              {expanded === c.id && (
                <div className="border-t border-border px-5 py-4 bg-secondary/30 flex flex-col gap-4">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Status</label>
                    <div className="flex gap-2">
                      {(["open", "in_progress", "resolved"] as const).map(s => (
                        <button
                          key={s}
                          onClick={() => setEditState(prev => ({ ...prev, [c.id]: { ...prev[c.id], status: s } }))}
                          className={`px-3 py-1.5 text-xs font-semibold rounded-lg border-2 transition-all ${
                            (editState[c.id]?.status ?? c.status) === s
                              ? "border-primary bg-primary text-primary-foreground"
                              : "border-border text-muted-foreground hover:border-primary/40"
                          }`}
                        >
                          {STATUS_LABELS[s]}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground block mb-1.5">Notes for customer (sent in update email)</label>
                    <textarea
                      value={editState[c.id]?.notes ?? (c.notes ?? "")}
                      onChange={e => setEditState(prev => ({ ...prev, [c.id]: { ...prev[c.id], notes: e.target.value } }))}
                      rows={4}
                      placeholder="Update notes sent to the customer…"
                      className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 resize-none bg-white"
                    />
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={() => handleUpdate(c)}
                      disabled={updating === c.id}
                      className="px-4 py-2 bg-primary text-primary-foreground text-sm font-bold rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
                    >
                      {updating === c.id ? "Saving…" : "Save & Email Customer"}
                    </button>
                    <p className="text-xs text-muted-foreground">Customer will receive an update email.</p>
                  </div>
                </div>
              )}
            </div>
          ))}

          {resolved.length > 0 && (
            <details className="mt-4">
              <summary className="text-sm text-muted-foreground font-medium cursor-pointer hover:text-foreground">
                {resolved.length} resolved case{resolved.length !== 1 ? "s" : ""}
              </summary>
              <div className="flex flex-col gap-2 mt-3">
                {resolved.map(c => (
                  <div key={c.id} className="bg-white border border-border rounded-xl px-5 py-3 flex items-center gap-3 opacity-70">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">CASE-{shortId(c.id)}</span>
                        <StatusBadge status={c.status} />
                      </div>
                      <p className="text-sm text-muted-foreground mt-0.5">{c.subject} · {c.customer_name}</p>
                    </div>
                    <span className="text-xs text-muted-foreground">{fmtDate(c.created_at)}</span>
                  </div>
                ))}
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CasesPage() {
  const [tab, setTab] = useState<"internal" | "support">("support");

  return (
    <div className="max-w-4xl mx-auto px-6 md:px-10 py-10">
      <h1 className="font-heading font-black text-3xl text-foreground mb-6">Cases</h1>

      {/* Tabs */}
      <div className="flex gap-1 bg-secondary rounded-xl p-1 mb-8 w-fit">
        {(["support", "internal"] as const).map(t => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-5 py-2 rounded-lg text-sm font-semibold transition-all ${
              tab === t
                ? "bg-white text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {t === "support" ? "Support Cases" : "Internal Reminders"}
          </button>
        ))}
      </div>

      {tab === "support" ? <SupportTab /> : <InternalTab />}
    </div>
  );
}
