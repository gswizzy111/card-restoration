"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

type Address = {
  street1?: string;
  street2?: string;
  city?: string;
  state?: string;
  zip?: string;
  country?: string;
};

const COUNTRIES: [string, string][] = [
  ["US", "United States"],
  ["CA", "Canada"],
  ["GB", "United Kingdom"],
  ["AU", "Australia"],
  ["AT", "Austria"],
  ["BE", "Belgium"],
  ["BR", "Brazil"],
  ["CL", "Chile"],
  ["CN", "China"],
  ["CO", "Colombia"],
  ["HR", "Croatia"],
  ["CZ", "Czech Republic"],
  ["DK", "Denmark"],
  ["EG", "Egypt"],
  ["FI", "Finland"],
  ["FR", "France"],
  ["DE", "Germany"],
  ["GR", "Greece"],
  ["HK", "Hong Kong"],
  ["HU", "Hungary"],
  ["IN", "India"],
  ["ID", "Indonesia"],
  ["IE", "Ireland"],
  ["IL", "Israel"],
  ["IT", "Italy"],
  ["JP", "Japan"],
  ["JO", "Jordan"],
  ["KW", "Kuwait"],
  ["LV", "Latvia"],
  ["LT", "Lithuania"],
  ["LU", "Luxembourg"],
  ["MY", "Malaysia"],
  ["MX", "Mexico"],
  ["NL", "Netherlands"],
  ["NZ", "New Zealand"],
  ["NG", "Nigeria"],
  ["NO", "Norway"],
  ["PK", "Pakistan"],
  ["PH", "Philippines"],
  ["PL", "Poland"],
  ["PT", "Portugal"],
  ["QA", "Qatar"],
  ["RO", "Romania"],
  ["SA", "Saudi Arabia"],
  ["SG", "Singapore"],
  ["ZA", "South Africa"],
  ["KR", "South Korea"],
  ["ES", "Spain"],
  ["SE", "Sweden"],
  ["CH", "Switzerland"],
  ["TW", "Taiwan"],
  ["TH", "Thailand"],
  ["TR", "Turkey"],
  ["AE", "United Arab Emirates"],
  ["VN", "Vietnam"],
];

interface Props {
  orderId: string;
  name: string;
  email: string;
  phone: string;
  address: Address | null;
}

export function KitCustomerEditor({ orderId, name, email, phone, address }: Props) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name,
    email,
    phone: phone ?? "",
    street1: address?.street1 ?? "",
    street2: address?.street2 ?? "",
    city: address?.city ?? "",
    state: address?.state ?? "",
    zip: address?.zip ?? "",
    country: address?.country ?? "US",
  });

  const isUS = form.country === "US";

  function handleChange(e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) {
    setForm((p) => ({ ...p, [e.target.name]: e.target.value }));
  }

  async function handleSave() {
    setError("");
    if (!form.name.trim() || !form.email.trim()) {
      setError("Name and email are required.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/customer`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
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
    const countryLabel = COUNTRIES.find(([code]) => code === address?.country)?.[1] ?? address?.country;
    return (
      <div className="flex flex-col gap-1 text-sm">
        <div className="flex items-start justify-between gap-2">
          <div className="flex flex-col gap-1">
            <p className="font-bold text-foreground">{name}</p>
            <p className="text-muted-foreground">{email}</p>
            {phone && <p className="text-muted-foreground">{phone}</p>}
            {address?.street1 && (
              <div className="mt-2 pt-2 border-t border-border text-muted-foreground">
                <p>{address.street1}{address.street2 ? `, ${address.street2}` : ""}</p>
                <p>{address.city}{address.state ? `, ${address.state}` : ""} {address.zip}</p>
                {address.country && address.country !== "US" && <p>{countryLabel}</p>}
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
          onClick={() => { setForm({ name, email, phone: phone ?? "", street1: address?.street1 ?? "", street2: address?.street2 ?? "", city: address?.city ?? "", state: address?.state ?? "", zip: address?.zip ?? "", country: address?.country ?? "US" }); setError(""); setOpen(false); }}
          className="text-xs text-muted-foreground hover:text-foreground transition-colors"
        >
          Cancel
        </button>
      </div>

      <input name="name" placeholder="Full name *" value={form.name} onChange={handleChange} className={inp} />
      <input name="email" type="email" placeholder="Email *" value={form.email} onChange={handleChange} className={inp} />
      <input name="phone" placeholder="Phone" value={form.phone} onChange={handleChange} className={inp} />

      <div className="border-t border-border pt-3 flex flex-col gap-2">
        <p className="text-xs text-muted-foreground font-medium">Shipping Address</p>

        {/* Country selector */}
        <select
          name="country"
          value={form.country}
          onChange={handleChange}
          className={inp}
        >
          {COUNTRIES.map(([code, label]) => (
            <option key={code} value={code}>{label}</option>
          ))}
        </select>

        <input name="street1" placeholder="Street address" value={form.street1} onChange={handleChange} className={inp} />
        <input name="street2" placeholder="Apt / Suite (optional)" value={form.street2} onChange={handleChange} className={inp} />
        <div className="grid grid-cols-3 gap-2">
          <input name="city" placeholder="City" value={form.city} onChange={handleChange} className={inp} />
          <input
            name="state"
            placeholder={isUS ? "State" : "Province"}
            value={form.state}
            onChange={handleChange}
            className={`${inp} text-center`}
          />
          <input
            name="zip"
            placeholder={isUS ? "ZIP" : "Postal Code"}
            value={form.zip}
            onChange={handleChange}
            className={inp}
          />
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      <button
        onClick={handleSave}
        disabled={saving}
        className="h-9 bg-primary text-primary-foreground rounded-lg text-sm font-semibold hover:bg-primary/90 transition-colors disabled:opacity-50"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
