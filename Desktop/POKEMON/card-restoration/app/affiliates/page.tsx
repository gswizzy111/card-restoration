"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PortalCard, PORTAL_BUTTON_CN, PORTAL_INPUT_CN, PORTAL_LABEL_CN } from "./portal-card";

export default function AffiliateLoginPage() {
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    const res = await fetch("/api/affiliates/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ code: code.trim(), password }),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      setLoading(false);
      return;
    }
    router.push("/affiliates/dashboard");
    router.refresh();
  }

  return (
    <PortalCard title="Creator Portal">
      <form onSubmit={handleLogin} className="flex flex-col gap-4">
        <div>
          <label htmlFor="creator-code" className={PORTAL_LABEL_CN}>Creator Code</label>
          <input
            id="creator-code"
            type="text"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            placeholder="Enter your creator code"
            autoComplete="username"
            autoCapitalize="characters"
            spellCheck={false}
            className={`${PORTAL_INPUT_CN} font-mono uppercase placeholder:normal-case placeholder:font-sans`}
            required
          />
        </div>
        <div>
          <label htmlFor="creator-password" className={PORTAL_LABEL_CN}>Password</label>
          <input
            id="creator-password"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            className={PORTAL_INPUT_CN}
            required
          />
        </div>
        {error && <p role="alert" className="text-sm text-red-600">{error}</p>}
        <button type="submit" disabled={loading} className={PORTAL_BUTTON_CN}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
        <p className="text-xs text-muted-foreground leading-relaxed text-center">
          New here, or forgot your password? Ask The Card Doc for your setup link.
        </p>
      </form>
    </PortalCard>
  );
}
