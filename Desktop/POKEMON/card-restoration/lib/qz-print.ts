// QZ Tray client-side utilities — BROWSER ONLY, never import server-side

// eslint-disable-next-line @typescript-eslint/no-explicit-any
let qz: any = null;

async function getQZ() {
  if (qz) return qz;
  const mod = await import("qz-tray");
  qz = mod.default ?? mod;

  qz.security.setCertificatePromise((_resolve: (v: string) => void, reject: (e: unknown) => void) => {
    try { _resolve(""); } catch (e) { reject(e); }
  });
  qz.security.setSignatureAlgorithm("SHA512");
  qz.security.setSignaturePromise((_toSign: string) => {
    return (_resolve: (v: string) => void, reject: (e: unknown) => void) => {
      try { _resolve(""); } catch (e) { reject(e); }
    };
  });

  return qz;
}

export async function connectQZ(): Promise<void> {
  const q = await getQZ();
  if (q.websocket.isActive()) return;
  await q.websocket.connect({ retries: 2, delay: 1 });
}

export async function disconnectQZ(): Promise<void> {
  if (!qz) return;
  if (qz.websocket.isActive()) await qz.websocket.disconnect();
}

export async function findPrinter(search = "D520"): Promise<string> {
  const q = await getQZ();
  const found: string | string[] = await q.printers.find(search);
  if (Array.isArray(found)) {
    if (found.length === 0) throw new Error(`No printer matching "${search}" found`);
    return found[0];
  }
  return found;
}

export async function listPrinters(): Promise<string[]> {
  const q = await getQZ();
  return q.printers.find();
}

/**
 * Print a label PDF via QZ Tray.
 * QZ Tray's desktop app fetches the URL natively (not through the browser),
 * so CORS is not an issue — we pass the URL directly.
 * If the label is detected as non-PDF (e.g. an old ZPL purchase), returns false
 * so the caller can fall back to opening the URL manually.
 */
export async function printLabel(labelUrl: string, printerName: string): Promise<boolean> {
  // Quick content-type check via our proxy to detect old ZPL labels
  try {
    const probe = await fetch(`/api/admin/proxy-label?url=${encodeURIComponent(labelUrl)}`, { method: "HEAD" }).catch(() => null);
    if (probe) {
      const ct = probe.headers.get("Content-Type") ?? "";
      if (!ct.includes("pdf")) {
        // Not a PDF (likely an old ZPL label) — can't print this way
        return false;
      }
    }
  } catch { /* ignore probe failures, try printing anyway */ }

  const q = await getQZ();
  const config = q.configs.create(printerName, {
    size: { width: 4, height: 6 },
    units: "in",
    scaleContent: true,
    margins: 0,
  });

  // format: "file" — QZ Tray desktop app fetches the URL directly at OS level,
  // no browser CORS applies. This is the approach that worked.
  await q.print(config, [{ type: "pdf", format: "file", data: labelUrl }]);
  return true;
}

export async function printZPL(zpl: string, printerName: string): Promise<void> {
  const q = await getQZ();
  const config = q.configs.create(printerName);
  await q.print(config, [{ type: "raw", format: "plain", data: zpl }]);
}

export function isQZActive(): boolean {
  return !!qz?.websocket?.isActive?.();
}
