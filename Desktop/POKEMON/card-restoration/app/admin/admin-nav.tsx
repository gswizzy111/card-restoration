"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useState } from "react";

const NAV_ITEMS = [
  { href: "/admin",              label: "Orders",       icon: "📋" },
  { href: "/admin/fast-pass",    label: "Fast Pass",    icon: "⚡" },
  { href: "/admin/prep-orders",  label: "Prep Orders",  icon: "🧪" },
  { href: "/admin/shop-orders",  label: "Kit Orders",   icon: "📦" },
  { href: "/admin/incoming",    label: "Incoming",   icon: "📬" },
  { href: "/admin/ship-queue",  label: "Ship Queue", icon: "🚚" },
  { href: "/admin/unclaimed",   label: "Unclaimed",  icon: "⏳" },
  { href: "/admin/partners",    label: "Partners",   icon: "🤝" },
  { href: "/admin/products",    label: "Products",   icon: "🛍️" },
  { href: "/admin/store-settings", label: "Store Settings",       icon: "⚙️" },
  { href: "/admin/prep-settings", label: "Prep Settings",         icon: "🔬" },
  { href: "/admin/affiliates",     label: "Affiliates & Coupons", icon: "🎯" },
  { href: "/admin/subscriptions",  label: "Subscriptions", icon: "🔁" },
  { href: "/admin/customers",      label: "Customers",     icon: "👥" },
  { href: "/admin/email-blast",    label: "Email Blast",   icon: "📧" },
  { href: "/admin/profit-loss",       label: "P&L",           icon: "💰" },
  { href: "/admin/sales-statement",   label: "Statement",     icon: "📄" },
  { href: "/admin/tax",               label: "Tax Reports",   icon: "🧾" },
  { href: "/admin/cases?filter=open&type=inquiry", label: "Update Requests", icon: "🔔" },
  { href: "/admin/cases",             label: "Cases",         icon: "🗂️" },
  { href: "/admin/gift-cards",     label: "Gift Cards",    icon: "🎁" },
  { href: "/admin/testimonials",     label: "Reviews",         icon: "⭐" },
  { href: "/admin/accountant",      label: "Accountant Access", icon: "🔐" },
  { href: "/admin/checkout-errors", label: "Checkout Errors", icon: "🚨" },
];

const ACCOUNTANT_NAV_ITEMS = [
  { href: "/admin/tax", label: "Tax Reports", icon: "🧾" },
];

function NavLinks({ onNavigate, openCaseCount, openUpdateRequestCount, role }: { onNavigate?: () => void; openCaseCount?: number; openUpdateRequestCount?: number; role?: string | null }) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const items = role === "accountant" ? ACCOUNTANT_NAV_ITEMS : NAV_ITEMS;

  // A filtered view of another page (Update Requests = cases of one type) is
  // active on that page with that type; the page's own item steps aside
  const activeFilter = items.find((item) => {
    const [path, query] = item.href.split("?");
    const type = query ? new URLSearchParams(query).get("type") : null;
    return !!type && pathname === path && searchParams.get("type") === type;
  })?.href;

  function isActive(href: string) {
    if (href === "/admin") return pathname === "/admin";
    if (href.includes("?")) return href === activeFilter;
    if (activeFilter?.startsWith(`${href}?`)) return false;
    return pathname.startsWith(href);
  }

  // Red count badges: open cases, and update requests waiting on a reply
  function badgeFor(href: string) {
    if (href === "/admin/cases") return openCaseCount ?? 0;
    if (href.startsWith("/admin/cases?") && href.includes("type=inquiry")) return openUpdateRequestCount ?? 0;
    return 0;
  }

  return (
    <>
      {items.map((item) => (
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
          <span className="flex-1">{item.label}</span>
          {badgeFor(item.href) > 0 ? (
            <span className="min-w-[18px] h-[18px] flex items-center justify-center rounded-full bg-red-500 text-white text-[10px] font-black px-1">
              {badgeFor(item.href) > 99 ? "99+" : badgeFor(item.href)}
            </span>
          ) : null}
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

// The signed-in admin's own page: change password and recovery email
function ProfileLink({ onNavigate }: { onNavigate?: () => void }) {
  const active = usePathname().startsWith("/admin/profile");
  return (
    <Link
      href="/admin/profile"
      onClick={onNavigate}
      className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
        active ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:bg-secondary hover:text-foreground"
      }`}
    >
      <span>👤</span>
      Profile
    </Link>
  );
}

export function AdminNav({ openCaseCount, openUpdateRequestCount, role, username }: { openCaseCount?: number; openUpdateRequestCount?: number; role?: string | null; username?: string | null }) {
  const [open, setOpen] = useState(false);

  return (
    <>
      {/* ── Desktop sidebar ── */}
      {/* Pinned to the viewport with its own scroll, so Sign out is always on screen */}
      <aside className="hidden lg:flex w-56 shrink-0 sticky top-0 h-screen bg-white border-r border-border flex-col">
        <div className="px-5 py-6 border-b border-border">
          <p className="font-heading font-black text-lg text-foreground">The Card Doc</p>
          <p className="text-xs text-muted-foreground mt-0.5">Admin</p>
        </div>
        <nav className="flex-1 min-h-0 overflow-y-auto px-3 py-4 flex flex-col gap-1">
          <NavLinks openCaseCount={openCaseCount} openUpdateRequestCount={openUpdateRequestCount} role={role} />
          {role === "accountant" && (
            <p className="text-[10px] font-semibold text-muted-foreground/60 uppercase tracking-widest px-3 pt-4">Accountant View</p>
          )}
        </nav>
        <div className="px-3 py-4 border-t border-border">
          {username && (
            <p className="px-3 pb-2 text-xs text-muted-foreground truncate">
              Signed in as <span className="font-semibold text-foreground">{username}</span>
            </p>
          )}
          {role === "admin" && <ProfileLink />}
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
        <div className="flex items-center gap-1">
        <form action="/api/admin/logout" method="POST">
          <button className="px-3 py-2 rounded-lg text-sm font-medium text-muted-foreground hover:bg-secondary hover:text-foreground transition-colors">
            Sign out
          </button>
        </form>
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
      </div>

      {/* ── Mobile drawer overlay ── */}
      {open && (
        <div className="lg:hidden fixed inset-0 z-30" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-black/40" />
        </div>
      )}
      <div className={`lg:hidden fixed top-14 left-0 right-0 z-30 max-h-[calc(100dvh-3.5rem)] overflow-y-auto bg-white border-b border-border transition-transform duration-200 ${open ? "translate-y-0" : "-translate-y-full pointer-events-none"}`}>
        <nav className="px-3 py-3 flex flex-col gap-1">
          <NavLinks onNavigate={() => setOpen(false)} openCaseCount={openCaseCount} openUpdateRequestCount={openUpdateRequestCount} role={role} />
        </nav>
        <div className="px-3 py-3 border-t border-border">
          {role === "admin" && <ProfileLink onNavigate={() => setOpen(false)} />}
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
