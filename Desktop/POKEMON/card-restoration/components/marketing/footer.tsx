import Link from "next/link";
import { Separator } from "@/components/ui/separator";

export function Footer() {
  return (
    <footer className="bg-foreground text-white mt-auto">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
          {/* Brand */}
          <div className="flex flex-col gap-3">
            <div className="flex items-center gap-2.5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="/card-doctor.jpg"
                alt="The Card Doc"
                className="w-9 h-9 rounded-full object-cover"
              />
              <span className="font-heading font-black text-xl">The Card Doc</span>
            </div>
            <p className="text-sm text-white/60 leading-relaxed">
              Expert PSA prep and card restoration. Every card treated like it&apos;s worth a fortune.
            </p>
            <p className="text-xs text-white/40 mt-auto pt-4">
              &copy; {new Date().getFullYear()} The Card Doc. All rights reserved.
            </p>
          </div>

          {/* Contact */}
          <div className="flex flex-col gap-3">
            <p className="text-xs font-bold uppercase tracking-widest text-white/40">Contact</p>
            <a
              href="https://www.instagram.com/thecarddoc"
              target="_blank"
              rel="noopener noreferrer"
              className="text-sm text-white/60 hover:text-white transition-colors"
            >
              DM us on @thecarddoc
            </a>
            <p className="text-sm text-white/60">We reply within 1 business day.</p>
          </div>
        </div>

        <Separator className="my-8 bg-white/10" />

        <div className="flex flex-col sm:flex-row gap-4 justify-between items-center">
          <p className="text-xs text-white/40">
            All cards are insured during transit. Results may vary by card condition.
          </p>
          <Link href="/terms" className="text-xs text-white/60 hover:text-white transition-colors">
            Terms & Conditions
          </Link>
        </div>
      </div>
    </footer>
  );
}
