"use client";

import { useState, useEffect } from "react";
import type { SavedLabel } from "@/app/api/admin/shop-orders/[id]/return-label/route";
import { connectQZ, findPrinter, printLabel, isQZActive, listPrinters } from "@/lib/qz-print";

type Rate = {
  objectId: string;
  provider: string;
  service: string;
  amount: string;
  currency: string;
  days: number | null;
};

type Props = {
  orderId: string;
  existingLabels?: SavedLabel[];
  labelName?: string;
};

export function ReturnLabelButton({ orderId, existingLabels: initialLabels = [], labelName = "Shipping" }: Props) {
  const [labels, setLabels] = useState<SavedLabel[]>(initialLabels);
  const [state, setState] = useState<"idle" | "fetching" | "confirm" | "purchasing" | "printing" | "error">("idle");
  const [rates, setRates] = useState<Rate[]>([]);
  const [selectedRate, setSelectedRate] = useState<Rate | null>(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [qzConnected, setQzConnected] = useState(false);
  const [printingIndex, setPrintingIndex] = useState<number | null>(null);
  const [needsRepurchase, setNeedsRepurchase] = useState<number | null>(null);
  const [addInsurance, setAddInsurance] = useState(false);
  const [insuranceValue, setInsuranceValue] = useState("");
  const [printerName, setPrinterName] = useState<string>(() =>
    typeof window !== "undefined" ? (localStorage.getItem("qz_printer") ?? "D520") : "D520"
  );

  useEffect(() => {
    connectQZ()
      .then(() => setQzConnected(true))
      .catch(() => setQzConnected(false));
  }, []);

  async function fetchRates() {
    setState("fetching");
    setErrorMsg("");
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/return-label`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Failed to get rates");
      setRates(data.rates);
      setSelectedRate(data.rates[0]);
      setState("confirm");
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  async function purchaseLabel() {
    if (!selectedRate) return;
    setState("purchasing");
    const insuranceCents = addInsurance && insuranceValue ? Math.round(parseFloat(insuranceValue) * 100) : 0;
    try {
      const res = await fetch(`/api/admin/shop-orders/${orderId}/return-label`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rateObjectId: selectedRate.objectId,
          ...(insuranceCents > 0 ? { insuranceDeclaredValueCents: insuranceCents } : {}),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Purchase failed");

      const newLabel: SavedLabel = data.newLabel;
      const updated = data.allLabels ?? [...labels, newLabel];
      setLabels(updated);
      setState("idle");

      await handlePrint(newLabel.labelUrl, updated.length - 1);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : "Unknown error");
      setState("error");
    }
  }

  async function handlePrint(labelUrl: string, index: number) {
    if (!qzConnected && !isQZActive()) {
      window.open(labelUrl, "_blank");
      return;
    }
    setPrintingIndex(index);
    try {
      await connectQZ();
      const printer = await findPrinter(printerName);
      const printed = await printLabel(labelUrl, printer);
      if (!printed) {
        // Non-PDF label (old ZPL purchase) — prompt repurchase
        setNeedsRepurchase(index);
      }
    } catch (err) {
      console.error("Print failed:", err);
      window.open(labelUrl, "_blank");
    } finally {
      setPrintingIndex(null);
    }
  }

  async function changePrinter() {
    try {
      await connectQZ();
      const all = await listPrinters();
      const picked = window.prompt(`Available printers:\n${all.join("\n")}\n\nType the printer name exactly:`);
      if (picked?.trim()) {
        localStorage.setItem("qz_printer", picked.trim());
        setPrinterName(picked.trim());
      }
    } catch {
      const picked = window.prompt("Enter printer name:");
      if (picked?.trim()) {
        localStorage.setItem("qz_printer", picked.trim());
        setPrinterName(picked.trim());
      }
    }
  }

  return (
    <div className="flex flex-col gap-3 mt-3">
      {/* QZ status bar */}
      <div className="flex items-center gap-2">
        <span className={`w-2 h-2 rounded-full shrink-0 ${qzConnected ? "bg-green-500" : "bg-gray-300"}`} />
        <span className="text-[10px] text-muted-foreground flex-1">
          {qzConnected ? `QZ Tray · ${printerName}` : "QZ Tray not detected — labels will open in browser"}
        </span>
        <button onClick={changePrinter} className="text-[10px] text-primary hover:underline shrink-0">
          {qzConnected ? "change" : "setup"}
        </button>
      </div>

      {/* Existing labels */}
      {labels.map((label, i) => (
        <div key={i} className="flex flex-col gap-2 p-3 bg-cyan-50 border border-cyan-200 rounded-lg">
          <div className="flex items-center justify-between gap-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-cyan-700">
              {labelName} Label {labels.length > 1 ? `#${i + 1}` : ""}
            </span>
            {label.createdAt && (
              <span className="text-[10px] text-cyan-600">{new Date(label.createdAt).toLocaleDateString()}</span>
            )}
          </div>
          {label.trackingNumber && (
            <p className="font-mono font-semibold text-sm text-cyan-900">{label.trackingNumber}</p>
          )}

          {needsRepurchase === i ? (
            <div className="flex flex-col gap-1.5">
              <p className="text-xs text-amber-700 font-medium">
                This label is in an older format — purchase a new PDF label to print directly.
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => { setNeedsRepurchase(null); fetchRates(); }}
                  className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90"
                >
                  Purchase New Label
                </button>
                <a href={label.labelUrl} target="_blank" rel="noopener noreferrer"
                  className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground">
                  Open File
                </a>
              </div>
            </div>
          ) : (
            <div className="flex gap-2 flex-wrap">
              <button
                onClick={() => handlePrint(label.labelUrl, i)}
                disabled={printingIndex === i}
                className="flex items-center gap-1.5 text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {printingIndex === i
                  ? <><span className="animate-pulse">🖨</span> Sending…</>
                  : <><span>🖨</span> {qzConnected ? "Print Label" : "Open Label"}</>
                }
              </button>
              <a
                href={label.labelUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-xs px-3 py-1.5 border border-border rounded-lg text-muted-foreground hover:text-foreground hover:border-primary/40 transition-colors"
              >
                Open PDF
              </a>
            </div>
          )}
        </div>
      ))}

      {/* Create new label */}
      {state === "idle" && (
        <button
          onClick={fetchRates}
          className="text-xs font-bold px-3 py-1.5 bg-secondary text-foreground border border-border rounded-lg hover:border-primary/40 transition-colors w-fit"
        >
          {labels.length === 0 ? `Create ${labelName} Label` : "+ Create Another Label"}
        </button>
      )}

      {state === "fetching" && <p className="text-xs text-muted-foreground">Getting rates…</p>}
      {state === "purchasing" && <p className="text-xs text-muted-foreground">Purchasing label…</p>}

      {state === "confirm" && selectedRate && (
        <div className="flex flex-col gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
          <p className="text-xs font-bold text-blue-900">Choose Rate</p>
          <div className="flex flex-col gap-1">
            {rates.map((r) => (
              <label key={r.objectId} className="flex items-center gap-2 text-xs cursor-pointer">
                <input
                  type="radio"
                  name={`rate-${orderId}`}
                  checked={selectedRate.objectId === r.objectId}
                  onChange={() => setSelectedRate(r)}
                  className="accent-primary"
                />
                <span className="text-blue-800">
                  <span className="font-bold">{r.provider}</span> {r.service}
                  {r.days ? ` · ${r.days}d` : ""} —{" "}
                  <span className="font-bold">${parseFloat(r.amount).toFixed(2)}</span>
                </span>
              </label>
            ))}
          </div>

          {/* Insurance */}
          <div className="border-t border-blue-200 pt-2 mt-1 flex flex-col gap-1.5">
            <label className="flex items-center gap-2 text-xs cursor-pointer select-none">
              <input
                type="checkbox"
                checked={addInsurance}
                onChange={(e) => setAddInsurance(e.target.checked)}
                className="accent-primary"
              />
              <span className="font-semibold text-blue-900">Add Shippo insurance</span>
            </label>
            {addInsurance && (
              <div className="flex items-center gap-2">
                <span className="text-xs text-blue-800">Declared value $</span>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={insuranceValue}
                  onChange={(e) => setInsuranceValue(e.target.value)}
                  placeholder="e.g. 100"
                  className="w-24 text-xs px-2 py-1 border border-blue-300 rounded bg-white text-blue-900"
                />
                {insuranceValue && parseFloat(insuranceValue) > 0 && (
                  <span className="text-xs text-blue-600">
                    ≈ ${(parseFloat(insuranceValue) * 0.015).toFixed(2)} fee
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-1">
            <button
              onClick={purchaseLabel}
              className="text-xs font-bold px-3 py-1.5 bg-primary text-primary-foreground rounded-lg hover:opacity-90 flex items-center gap-1.5"
            >
              🖨 Purchase & Print (${parseFloat(selectedRate.amount).toFixed(2)}{addInsurance && insuranceValue && parseFloat(insuranceValue) > 0 ? ` + ~$${(parseFloat(insuranceValue) * 0.015).toFixed(2)} ins.` : ""})
            </button>
            <button onClick={() => setState("idle")} className="text-xs px-3 py-1.5 text-muted-foreground hover:text-foreground">
              Cancel
            </button>
          </div>
        </div>
      )}

      {state === "error" && (
        <div className="flex items-center gap-2">
          <p className="text-xs text-red-600">{errorMsg}</p>
          <button onClick={() => setState("idle")} className="text-xs text-muted-foreground hover:text-foreground">Dismiss</button>
        </div>
      )}
    </div>
  );
}
