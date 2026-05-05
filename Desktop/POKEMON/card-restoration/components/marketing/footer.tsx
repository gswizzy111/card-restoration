import Link from "next/link";
import { Separator } from "@/components/ui/separator";

const contactEmail = process.env.FROM_EMAIL ?? "thecarddoc@gmail.com";

export function Footer() {
  return (
    <footer className="bg-foreground text-white mt-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-10">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-full flex items-center justify-center">
                <span className="text-white font-heading font-black text-sm">TC</span>
              </div>
              <span className="font-heading font-black text-xl">The Card Doc</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Expert PSA prep and card restoration. Every card treated like it&apos;s worth a fortune.
            </p>
            <p className="text-xs text-white/40 mt-auto pt-4">
              &copy; {new Date().getFullYear()} The Card Doc. All rights reserved.
            </p>
          </div>

          {/* Quick links */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Quick Links</p>
            <div className="flex flex-col gap-2">
              {[
                { href: "/services", label: "Services" },
                { href: "/how-it-works", label: "How It Works" },
                { href: "/faq", label: "FAQ" },
                { href: "/track", label: "Track Order" },
                { href: "/order", label: "Start an Order" },
              ].map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  className="text-sm text-white/60 hover:text-white transition-colors"
                >
                  {l.label}
                </Link>
              ))}
            </div>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Contact</p>
            <a
              href={`mailto:${contactEmail}`}
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              {contactEmail}
            </a>
            <p className="text-sm text-white/60">We reply within 1 business day.</p>
          </div>
        </div>

        <Separator className="my-8 bg-white/10" />

        <p className="text-xs text-white/40 text-center">
          All cards are insured during transit. Results may vary by card condition.
        </p>
      </div>
    </footer>
  );
}
