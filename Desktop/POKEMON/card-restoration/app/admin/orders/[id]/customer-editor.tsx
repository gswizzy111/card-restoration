"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AddressAutocomplete } from "@/components/ui/address-autocomplete";

interface Props {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
}

export function CustomerEditor({ orderId, name, email, phone, street1 = "", street2 = "", city = "", state = "", zip = "" }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({ name, email, phone, street1, street2, city, state, zip });

  function set(field: string, value: string) {
    setForm((p) => ({ ...p, [field]: value }));
  }

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    set(e.target.name, e.target.value);
  }

  async function handleSave() {
    setError("");
    if (!form.name.trim() || !form.email.trim() || !form.phone.trim()) {
      setError("Name, email, and phone are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        // API expects customer_name / customer_email / customer_phone
        body: JSON.stringify({
          customer_name: form.name.trim(),
          customer_email: form.email.trim(),
          customer_phone: form.phone.trim(),
          street1: form.street1,
          street2: form.street2,
          city: form.city,
          state: form.state,
          zip: form.zip,
        }),
      });
      const data = await res.json();
      if (!res.ok) { setError(data.error ?? "Failed to save."); setSaving(false); return; }
      setOpen(false);
      router.refresh();
    } catch {
      setError("Network error.");
      setSaving(false);
    }
  }

  const inp = "w-full h-9 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary bg-white transition-colors";

  if (!open) {
    return (
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p className="font-bold text-foreground">{name}</p>
            <p className="text-muted-foreground">{email}</p>
            <p className="text-muted-foreground">{phone}</p>
            {street1 && (
              <div className="mt-2 pt-2 border-t border-border text-muted-foreground">
                <p>{street1}</p>
                {street2 && <p>{street2}</p>}
                <p>{city}, {state} {zip}</p>
              </div>
            )}
          </div>
          <button
            onClick={() => setOpen(true)}
            className="shrink-0 text-xs font-semibold text-primary hover:text-primary/80 transition-colors"
          >
            Edit
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Edit Customer</p>
        <button
          onClick={() => { setForm({ name, email, phone, street1, street2, city, state, zip }); setError(""); setOpen(false); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <input name="name" placeholder="Full name *" value={form.name} onChange={handleChange} className={inp} autoComplete="name" />
      <input name="email" type="email" placeholder="Email *" value={form.email} onChange={handleChange} className={inp} autoComplete="email" />
      <input name="phone" placeholder="Phone *" value={form.phone} onChange={handleChange} className={inp} autoComplete="tel" />

      <div className="border-t border-border pt-3 flex flex-col gap-2">
        <p className="text-xs text-muted-foreground font-medium">Address</p>
        <AddressAutocomplete
          value={form.street1}
          onChange={(v) => set("street1", v)}
          onPlaceSelect={(fields) => {
            setForm((p) => ({
              ...p,
              street1: fields.street1,
              city: fields.city,
              state: fields.state,
              zip: fields.zip,
            }));
          }}
          placeholder="Street address"
          className={inp}
        />
        <input name="street2" placeholder="Apt / Suite (optional)" value={form.street2} onChange={handleChange} className={inp} autoComplete="address-line2" />
        <div className="grid grid-cols-3 gap-2">
          <input name="city" placeholder="City" value={form.city} onChange={handleChange} className={inp} autoComplete="address-level2" />
          <input name="state" placeholder="State" value={form.state} onChange={handleChange} className={`${inp} text-center uppercase`} autoComplete="address-level1" maxLength={2} />
          <input name="zip" placeholder="ZIP" value={form.zip} onChange={handleChange} className={inp} autoComplete="postal-code" />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="h-9 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save Changes"}
      </button>
    </div>
  );
}
