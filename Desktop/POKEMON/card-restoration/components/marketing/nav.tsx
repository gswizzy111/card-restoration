"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu, ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { useCart } from "@/lib/cart-context";

const links = [
  { href: "/shop", label: "Shop" },
  { href: "/restoration", label: "Restoration" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/track", label: "Track Order" },
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
      className={`sticky top-0 z-50 transition-all duration-200 ${
        scrolled ? "bg-white/95 backdrop-blur shadow-md border-b border-border" : "bg-white"
      }`}
    >
      <div className="h-1 bg-primary w-full" />

      <nav className="max-w-6xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/card-doctor.jpg" alt="The Card Doc" className="w-10 h-10 rounded-full object-cover border-2 border-primary" />
          <span className="font-heading font-black text-xl text-foreground tracking-tight">The Card Doc</span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link key={l.href} href={l.href} className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200">
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop right: cart + CTA */}
        <div className="hidden md:flex items-center gap-3">
          <Link href="/cart" className="relative p-2 text-muted-foreground hover:text-primary transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          <Button render={<Link href="/order" />} className="font-bold">
            Book Restoration
          </Button>
        </div>

        {/* Mobile */}
        <div className="flex items-center gap-2 md:hidden">
          <Link href="/cart" className="relative p-2 text-muted-foreground hover:text-primary transition-colors">
            <ShoppingCart className="h-5 w-5" />
            {itemCount > 0 && (
              <span className="absolute -top-0.5 -right-0.5 w-4 h-4 bg-primary text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                {itemCount}
              </span>
            )}
          </Link>
          <Sheet open={open} onOpenChange={setOpen}>
            <SheetTrigger className="p-2 text-foreground" aria-label="Open menu">
              <Menu className="h-5 w-5" />
            </SheetTrigger>
            <SheetContent side="right" className="w-72">
              <div className="flex flex-col gap-6 pt-8 px-6">
                <Link href="/" onClick={() => setOpen(false)} className="flex items-center gap-2.5">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/card-doctor.jpg" alt="The Card Doc" className="w-10 h-10 rounded-full object-cover border-2 border-primary" />
                  <span className="font-heading font-black text-xl text-primary">The Card Doc</span>
                </Link>
                <div className="flex flex-col gap-4">
                  {links.map((l) => (
                    <Link key={l.href} href={l.href} onClick={() => setOpen(false)} className="text-base font-medium text-muted-foreground hover:text-primary transition-colors">
                      {l.label}
                    </Link>
                  ))}
                </div>
                <Button render={<Link href="/order" onClick={() => setOpen(false)} />} className="mt-2 font-bold">
                  Book Restoration
                </Button>
              </div>
            </SheetContent>
          </Sheet>
        </div>
      </nav>
    </header>
  );
}
