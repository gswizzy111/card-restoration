"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin",             label: "Orders",     icon: "📋" },
  { href: "/admin/shop-orders", label: "Kit Orders", icon: "📦" },
  { href: "/admin/partners",    label: "Partners",   icon: "🤝" },
  { href: "/admin/products",    label: "Products",   icon: "🛍️" },
  { href: "/admin/affiliates",  label: "Affiliates", icon: "🎯" },
  { href: "/admin/customers",   label: "Customers",  icon: "👥" },
];

function NavLinks({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    return pathname.startsWith(href);
  }

  return (
    <>
      {NAV_ITEMS.map((item) => (
        <Link
          key={item.href}
          href={item.href}
          onClick={onNavigate}
          className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
            isActive(item.href)
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:bg-secondary hover:text-foreground"
          }`}
        >
          <span>{item.icon}</span>
          {item.label}
        </Link>
      ))}
      <a
        href="https://analytics.google.com"
        target="_blank"
        rel="noopener noreferrer"
        onClick={onNavigate}
        className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors"
      >
        <span>📊</span>
        Analytics
      </a>
    </>
  );
}

export function AdminNav() {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      <aside className="hidden lg:flex w-56 shrink-0 min-h-screen bg-white border-r border-border flex-col">
        <div className="px-5 py-6 border-b border-border">
          <p className="font-heading font-black text-lg text-foreground">The Card Doc</p>
          <p className="text-xs text-muted-foreground mt-0.5">Admin</p>
        </div>
        <nav className="flex-1 px-3 py-4 flex flex-col gap-1">
          <NavLinks />
        </nav>
        <div className="px-3 py-4 border-t border-border">
          <form action="/api/admin/logout" method="POST">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-left">
              <span>🚪</span>
              Sign out
            </button>
          </form>
        </div>
      </aside>

      {/* ── Mobile top bar ── */}
      <div className="lg:hidden fixed top-0 left-0 right-0 z-40 bg-white border-b border-border flex items-center justify-between px-4 h-14">
        <p className="font-heading font-black text-base text-foreground">The Card Doc Admin</p>
        <button
          onClick={() => setOpen(!open)}
          className="p-2 rounded-lg text-muted-foreground hover:bg-secondary transition-colors"
          aria-label="Toggle menu"
        >
          {open ? (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M4 4l12 12M16 4L4 16" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
          )}
        </button>
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}
      <div className={`lg:hidden fixed top-14 left-0 right-0 z-30 bg-white border-b border-border transition-transform duration-200 ${open ? "translate-y-0" : "-translate-y-full pointer-events-none"}`}>
        <nav className="px-3 py-3 flex flex-col gap-1">
          <NavLinks onNavigate={() => setOpen(false)} />
        </nav>
        <div className="px-3 py-3 border-t border-border">
          <form action="/api/admin/logout" method="POST">
            <button className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors text-left">
              <span>🚪</span>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </>
  );
}
