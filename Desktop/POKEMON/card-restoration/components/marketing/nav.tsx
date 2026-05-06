"use client";

import Link from "next/link";
import { useState, useEffect } from "react";
import { Menu } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";

const links = [
  { href: "/services", label: "Services" },
  { href: "/how-it-works", label: "How It Works" },
  { href: "/faq", label: "FAQ" },
  { href: "/track", label: "Track Order" },
];

export function Nav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

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
      {/* Red top bar */}
      <div className="h-1 bg-primary w-full" />

      <nav className="max-w-6xl mx-auto px-6 md:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/card-doctor.jpg"
            alt="The Card Doc"
            className="w-10 h-10 rounded-full object-cover border-2 border-primary"
          />
          <span className="font-heading font-black text-xl text-foreground tracking-tight">
            The Card Doc
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden md:flex items-center gap-8">
          {links.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm font-medium text-muted-foreground hover:text-primary transition-colors duration-200"
            >
              {l.label}
            </Link>
          ))}
        </div>

        {/* Desktop CTA */}
        <div className="hidden md:block">
          <Button render={<Link href="/order" />} className="font-bold">
            Start an Order
          </Button>
        </div>

        {/* Mobile hamburger */}
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetTrigger className="md:hidden p-2 text-foreground" aria-label="Open menu">
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
                  <Link
                    key={l.href}
                    href={l.href}
                    onClick={() => setOpen(false)}
                    className="text-base font-medium text-muted-foreground hover:text-primary transition-colors"
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
              <Button render={<Link href="/order" onClick={() => setOpen(false)} />} className="mt-2 font-bold">
                Start an Order
              </Button>
            </div>
          </SheetContent>
        </Sheet>
      </nav>
    </header>
  );
}
