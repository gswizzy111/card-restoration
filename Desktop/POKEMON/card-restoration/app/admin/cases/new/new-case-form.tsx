"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function NewCaseForm() {
  const router = useRouter();
  const [type, setType] = useState<"internal" | "support">("internal");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priority, setPriority] = useState<"low" | "normal" | "high" | "urgent">("normal");
  const [customerName, setCustomerName] = useState("");
  const [customerEmail, setCustomerEmail] = useState("");
  const [customerPhone, setCustomerPhone] = useState("");
  const [orderRef, setOrderRef] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const inputClass = "w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors bg-white";
  const labelClass = "block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!title.trim()) { setError("Title is required."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch("/api/admin/cases", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ type, title: title.trim(), description: description.trim(), priority, customer_name: customerName, customer_email: customerEmail, customer_phone: customerPhone, order_ref: orderRef }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong."); setSubmitting(false); return; }
      router.push(`/admin/cases/${data.id}`);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">

      {/* Type toggle */}
      <div className="bg-white rounded-xl border border-border p-6">
        <p className={labelClass}>Case Type</p>
        <div className="flex gap-2 mt-1">
          {(["internal", "support"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setType(t)}
              className={`px-5 py-2 rounded-lg text-sm font-bold border transition-colors ${type === t ? "bg-primary text-primary-foreground border-primary" : "bg-white text-muted-foreground border-border hover:border-primary/50"}`}
            >
              {t === "internal" ? "Internal" : "Support (Customer)"}
            </button>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          {type === "internal" ? "Private note for your team — not shared with any customer." : "Linked to a customer — they get email updates when you add visible notes."}
        </p>
      </div>

      {/* Core fields */}
      <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
        <h2 className="font-heading font-black text-lg">Case Details</h2>
        <div>
          <label className={labelClass}>Title *</label>
          <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Brief description of the issue" />
        </div>
        <div>
          <label className={labelClass}>Description</label>
          <textarea
            className="w-full border border-border rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-primary bg-white resize-none transition-colors"
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="More detail about what happened or what needs to be looked into..."
          />
        </div>
        <div>
          <label className={labelClass}>Priority</label>
          <select className={inputClass} value={priority} onChange={(e) => setPriority(e.target.value as typeof priority)}>
            <option value="low">Low</option>
            <option value="normal">Normal</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </div>
        <div>
          <label className={labelClass}>Order # (optional)</label>
          <input className={inputClass} value={orderRef} onChange={(e) => setOrderRef(e.target.value)} placeholder="e.g. 1042" />
        </div>
      </div>

      {/* Customer fields — support only */}
      {type === "support" && (
        <div className="bg-white rounded-xl border border-border p-6 flex flex-col gap-4">
          <h2 className="font-heading font-black text-lg">Customer Info</h2>
          <p className="text-xs text-muted-foreground -mt-2">Customer will receive email updates when you mark notes as visible to them.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className={labelClass}>Name</label>
              <input className={inputClass} value={customerName} onChange={(e) => setCustomerName(e.target.value)} placeholder="John Smith" />
            </div>
            <div>
              <label className={labelClass}>Email</label>
              <input className={inputClass} type="email" value={customerEmail} onChange={(e) => setCustomerEmail(e.target.value)} placeholder="john@example.com" />
            </div>
            <div>
              <label className={labelClass}>Phone</label>
              <input className={inputClass} value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="(555) 555-5555" />
            </div>
          </div>
        </div>
      )}

      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}

      <div className="flex justify-between">
        <a href="/admin/cases" className="h-10 px-5 border border-border rounded-lg text-sm font-semibold text-foreground flex items-center hover:bg-secondary transition-colors">
          Cancel
        </a>
        <button type="submit" disabled={submitting} className="h-10 px-8 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50">
          {submitting ? "Opening..." : "Open Case"}
        </button>
      </div>
    </form>
  );
}
