"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, ShoppingCart, X } from "lucide-react";
import { useCart } from "@/lib/cart-context";

const links = [
  { href: "/shop", label: "Restoration Kits" },
  { href: "/restoration", label: "Restoration Service" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);
  const { itemCount } = useCart();

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 8);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  return (
    <header
      className={`sticky top-0 z-50 bg-background transition-shadow duration-200 ${
        scrolled ? "shadow-sm border-b border-border" : "border-b border-border/50"
      }`}
    >
      <nav className="max-w-7xl mx-auto px-6 md:px-10 h-[70px] flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-3 shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/card-doctor.jpg" alt="The Card Doc" className="w-9 h-9 rounded-full object-cover" />
          <span className="font-heading text-xl font-bold text-foreground">The Card Doc</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors duration-150"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop right */}
        <div className="hidden md:flex items-center gap-4 shrink-0">
          <Link href="/cart" className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          <Link
            href="/restoration"
            className="text-sm font-semibold text-primary border border-primary/50 px-4 py-2 hover:bg-primary hover:text-primary-foreground transition-colors duration-150"
          >
            Book Restoration
          </Link>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-3 md:hidden">
          <Link href="/cart" className="relative p-1.5 text-muted-foreground hover:text-foreground transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-primary-foreground text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          <button
            onClick={() => setOpen(!open)}
            className="p-1.5 text-foreground"
            aria-label={open ? "Close menu" : "Open menu"}
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile dropdown */}
      {open && (
        <div className="md:hidden bg-background border-t border-border px-6 py-6 flex flex-col gap-5">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              onClick={() => setOpen(false)}
              className="text-base font-medium text-muted-foreground hover:text-foreground transition-colors"
            >
              {l.label}
            </Link>
          ))}
          <Link
            href="/restoration"
            onClick={() => setOpen(false)}
            className="text-sm font-semibold text-primary border border-primary/50 px-4 py-3 text-center hover:bg-primary hover:text-primary-foreground transition-colors"
          >
            Book Restoration
          </Link>
        </div>
      )}
    </header>
  );
}
