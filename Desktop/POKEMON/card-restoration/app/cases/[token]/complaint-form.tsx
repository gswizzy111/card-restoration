"use client";

import { useState } from "react";

export function ComplaintForm({ caseId, token }: { caseId: string; token: string }) {
  const [complaint, setComplaint] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!complaint.trim()) { setError("Please describe your complaint."); return; }
    setError("");
    setSubmitting(true);
    try {
      const res = await fetch(`/api/cases/${token}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ complaint: complaint.trim() }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Something went wrong. Please try again."); setSubmitting(false); return; }
      setDone(true);
    } catch {
      setError("Network error. Please try again.");
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="text-center py-6">
        <div className="text-4xl mb-3">✅</div>
        <p className="font-black text-lg text-gray-900 mb-2">Complaint submitted</p>
        <p className="text-sm text-gray-500 leading-relaxed">
          We&apos;ll review your case and get back to you within <strong>3 business days</strong>.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <div>
        <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-1.5">
          Your complaint *
        </label>
        <textarea
          className="w-full border border-gray-200 rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-gray-400 bg-white resize-none transition-colors"
          rows={6}
          value={complaint}
          onChange={(e) => setComplaint(e.target.value)}
          placeholder="Please describe what happened, including any relevant order details, dates, or other information that will help us investigate..."
          autoFocus
        />
      </div>
      {error && <p className="text-sm text-red-500 font-medium">{error}</p>}
      <button
        type="submit"
        disabled={submitting || !complaint.trim()}
        className="w-full h-11 bg-gray-900 text-white rounded-xl text-sm font-bold hover:bg-gray-800 transition-colors disabled:opacity-40"
      >
        {submitting ? "Submitting..." : "Submit Complaint"}
      </button>
    </form>
  );
}
