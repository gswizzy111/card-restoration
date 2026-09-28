declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    fbq: (...args: any[]) => void;
    _fbq: unknown;
  }
}

export const PIXEL_ID = "2149575685996056";

// Safe wrapper — no-ops if fbq hasn't loaded yet (shouldn't happen after init, but be defensive)
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function fbq(...args: any[]) {
  if (typeof window !== "undefined" && typeof window.fbq === "function") {
    window.fbq(...args);
  }
}
