"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";
import { CheckEmail, type ConfirmSent } from "./check-email";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  // Only paths on this site after signing in: a single leading slash, and no
  // backslashes or control characters (browsers drop tabs and newlines, so
  // "/<tab>/evil.example" would otherwise become "//evil.example")
  const rawNext = searchParams.get("next");
  const next = rawNext && /^\/(?!\/)/.test(rawNext) && !/[\\\u0000-\u001f\u007f]/.test(rawNext) ? rawNext : "/account";

  const [tab, setTab] = useState<"login" | "signup">(searchParams.get("tab") === "signup" ? "signup" : "login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  // The confirm email is on its way (after signing up, or signing in unconfirmed)
  const [confirm, setConfirm] = useState<ConfirmSent | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    const url = tab === "login"
      ? "/api/account/auth/login"
      : "/api/account/auth/signup";
    const body = tab === "login"
      ? { email, password }
      : { email, password, name };

    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const data = await res.json().catch(() => ({}));
    setLoading(false);

    // New accounts confirm their email first (the link opens the account)
    if (data.confirmationSent || data.code === "EMAIL_NOT_CONFIRMED") {
      setConfirm({
        email: email.trim(),
        password,
        sent: !!data.confirmationSent,
        sentFrom: data.sentFrom,
        subject: data.subject,
        message: data.error,
      });
      return;
    }

    if (!res.ok) {
      setError(data.error ?? "Something went wrong. Please try again.");
      return;
    }

    router.push(next);
    router.refresh();
  }

  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-heading font-black text-2xl text-foreground hover:text-primary transition-colors">
            The Card Doc
          </Link>
          <p className="text-muted-foreground text-sm mt-2">Customer portal</p>
        </div>

        {confirm ? (
          <CheckEmail
            info={confirm}
            onConfirmed={() => { router.push(next); router.refresh(); }}
            onStartOver={() => { setConfirm(null); setTab("signup"); setEmail(""); setPassword(""); setError(""); }}
            onBack={() => { setConfirm(null); setTab("login"); setPassword(""); setError(""); }}
          />
        ) : (
        <div className="bg-white rounded-2xl border border-border shadow-sm overflow-hidden">
          {/* Tabs */}
          <div className="grid grid-cols-2 border-b border-border">
            {(["login", "signup"] as const).map((t) => (
              <button
                key={t}
                onClick={() => { setTab(t); setError(""); }}
                className={`py-3.5 text-sm font-bold transition-colors ${
                  tab === t
                    ? "text-primary border-b-2 border-primary bg-primary/5"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {t === "login" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          <form onSubmit={handleSubmit} className="p-6 flex flex-col gap-4">
            {tab === "signup" && (
              <div>
                <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1.5">Full Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                  placeholder="Jane Smith"
                  className="w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            <div>
              <label className="text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={tab === "signup" ? 8 : 1}
                placeholder={tab === "signup" ? "At least 8 characters" : ""}
                className="w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors"
              />
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-700">
                {error}
              </div>
            )}

            <button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
            >
              {loading
                ? "Please wait…"
                : tab === "login"
                  ? "Sign In"
                  : "Create Account"}
            </button>

            {tab === "login" && (
              <p className="text-sm text-center">
                <Link href="/account/forgot-password" className="font-semibold text-primary hover:underline">Forgot your password?</Link>
              </p>
            )}

            {tab === "signup" && (
              <p className="text-xs text-center text-muted-foreground">
                Use the same email you used when placing your order so your orders appear automatically.
              </p>
            )}
          </form>
        </div>
        )}
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
