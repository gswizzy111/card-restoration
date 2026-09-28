import Link from "next/link";
import { getTestimonials } from "@/lib/testimonials";

export const dynamic = "force-dynamic";

const FAQ = [
  {
    q: "What's the difference between Restoration and Prep?",
    a: "Restoration improves how your card looks — cleaning surfaces, softening corners, reducing scuffs and scratches. PSA Prep is specifically for submitting to graders: we clean, sleeve, and organize your submission for the best possible grade. Most collectors do prep before grading, restoration before or after.",
  },
  {
    q: "Will restoration affect my card's PSA grade?",
    a: "There is a risk — we're fully transparent about that. If you plan to grade your card, restoration may affect how it's received. We'll always be upfront with you about what's realistic for your card.",
  },
  {
    q: "How do I ship my cards to you?",
    a: "You can choose to have us generate a prepaid label (we email it to you — print and drop off), or ship on your own using any tracked, insured method. We recommend USPS Priority Mail.",
  },
  {
    q: "What types of cards do you work on?",
    a: "All trading cards — Pokémon, sports cards (baseball, basketball, football, hockey), Magic: The Gathering, Yu-Gi-Oh!, and more. Vintage or modern, raw or graded.",
  },
  {
    q: "How long does it take?",
    a: "Prep typically turns around in 10–15 business days. Restorations range from 2–3 months (Bronze) down to 3–5 business days (Ultra Premium) depending on the tier you choose.",
  },
];

const TOS_HIGHLIGHTS = [
  {
    title: "Turnaround times are estimates",
    body: "All turnaround times shown are rough estimates and not guaranteed. Actual processing may be affected by order volume, card condition, shipping delays, or circumstances outside our control.",
  },
  {
    title: "You assume shipping risk",
    body: "You are responsible for selecting your shipping method and carrier. The Card Doc assumes no responsibility for loss or damage in transit until items are physically received and confirmed.",
  },
  {
    title: "Restoration alters your card",
    body: "Restoration is detectable by professional graders and results in an 'Altered' designation. If your card is damaged during restoration, our liability is limited to the service fee paid — not the card's market value.",
  },
  {
    title: "No refunds after work begins",
    body: "All sales are final once restoration work has commenced. If we believe a card won't respond well to treatment, we will contact you before proceeding.",
  },
];

export default async function HomePage() {
  let testimonials: Awaited<ReturnType<typeof getTestimonials>> = [];
  try {
    testimonials = await getTestimonials();
  } catch {
    testimonials = [];
  }

  return (
    <div className="min-h-screen bg-white">

      {/* ── Hero ── */}
      <section className="bg-gradient-to-br from-[#1a8fe0] to-[#0d6ab3] text-white">
        <div className="max-w-5xl mx-auto px-6 md:px-10 py-20 md:py-28 text-center">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/card-doctor.jpg" alt="The Card Doc" className="w-20 h-20 rounded-full object-cover mx-auto mb-6 border-4 border-white/30 shadow-lg" />
          <h1 className="font-heading text-5xl md:text-6xl font-black text-white mb-4 leading-tight">
            The Card Doc
          </h1>
          <p className="text-xl text-blue-100 mb-10 max-w-xl mx-auto leading-relaxed">
            Expert card restoration &amp; PSA prep — every card treated like it&apos;s worth a fortune.
          </p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 max-w-3xl mx-auto">
            <Link
              href="/tier-selection"
              className="group bg-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-blue-500 to-blue-400 w-full" />
              <div className="p-6 flex flex-col flex-1">
                <div className="w-11 h-11 rounded-xl bg-blue-50 flex items-center justify-center text-xl mb-4 shrink-0">✨</div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-blue-500 mb-1">Service</p>
                <h2 className="font-heading text-xl font-black text-slate-900 mb-2 leading-tight">Restoration</h2>
                <p className="text-sm text-slate-500 leading-relaxed flex-1">Surfaces, corners &amp; edges — cleaned and restored to their best.</p>
                <p className="text-xs font-semibold text-slate-400 mt-3 mb-4">From <span className="text-slate-700 font-black">$75</span> / card</p>
                <div className="w-full bg-slate-900 group-hover:bg-blue-600 text-white text-sm font-bold py-2.5 rounded-xl text-center transition-colors duration-200">
                  View Tiers →
                </div>
              </div>
            </Link>

            <Link
              href="/prep"
              className="group bg-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-emerald-500 to-teal-400 w-full" />
              <div className="p-6 flex flex-col flex-1">
                <div className="w-11 h-11 rounded-xl bg-emerald-50 flex items-center justify-center text-xl mb-4 shrink-0">🔬</div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-emerald-600 mb-1">Service</p>
                <h2 className="font-heading text-xl font-black text-slate-900 mb-2 leading-tight">Prep</h2>
                <p className="text-sm text-slate-500 leading-relaxed flex-1">Grade-ready submission prep for PSA, BGS &amp; CGC.</p>
                <p className="text-xs font-semibold text-slate-400 mt-3 mb-4">From <span className="text-slate-700 font-black">$25</span> / card</p>
                <div className="w-full bg-slate-900 group-hover:bg-emerald-600 text-white text-sm font-bold py-2.5 rounded-xl text-center transition-colors duration-200">
                  View Pricing →
                </div>
              </div>
            </Link>

            <Link
              href="/shop"
              className="group bg-white rounded-2xl shadow-xl hover:shadow-2xl hover:-translate-y-1 transition-all duration-200 flex flex-col overflow-hidden"
            >
              <div className="h-1.5 bg-gradient-to-r from-amber-500 to-orange-400 w-full" />
              <div className="p-6 flex flex-col flex-1">
                <div className="w-11 h-11 rounded-xl bg-amber-50 flex items-center justify-center text-xl mb-4 shrink-0">🛠️</div>
                <p className="text-[10px] font-bold uppercase tracking-widest text-amber-600 mb-1">Shop</p>
                <h2 className="font-heading text-xl font-black text-slate-900 mb-2 leading-tight">DIY Kits</h2>
                <p className="text-sm text-slate-500 leading-relaxed flex-1">The same pro-grade tools The Card Doc uses — delivered to you.</p>
                <p className="text-xs font-semibold text-slate-400 mt-3 mb-4"><span className="text-slate-700 font-black">Free shipping</span> on all kits</p>
                <div className="w-full bg-slate-900 group-hover:bg-amber-500 text-white text-sm font-bold py-2.5 rounded-xl text-center transition-colors duration-200">
                  Shop Now →
                </div>
              </div>
            </Link>
          </div>
        </div>
      </section>

      {/* ── Proven Results (single large section) ── */}
      <section className="bg-slate-900 text-white py-16 md:py-20">
        <div className="max-w-5xl mx-auto px-6 md:px-10 text-center">
          <p className="text-xs font-bold uppercase tracking-widest text-blue-400 mb-4">Why Collectors Trust Us</p>
          <h2 className="font-heading text-4xl md:text-5xl font-black text-white mb-6 leading-tight">
            Proven Results,<br className="hidden md:block" /> Every Time
          </h2>
          <p className="text-lg text-white/70 max-w-2xl mx-auto mb-12 leading-relaxed">
            Hundreds of cards restored and prepped — documented with before &amp; after photos for every submission. We don&apos;t just claim results, we show them.
          </p>
          <div className="grid grid-cols-3 gap-4 md:gap-8 max-w-xl mx-auto mb-10">
            {[
              { stat: "500+", label: "Cards Restored" },
              { stat: "4.9★", label: "Avg. Rating" },
              { stat: "100%", label: "Documented" },
            ].map((s) => (
              <div key={s.stat} className="text-center">
                <div className="text-3xl md:text-4xl font-black text-white mb-1">{s.stat}</div>
                <div className="text-xs text-white/50 font-medium uppercase tracking-wide">{s.label}</div>
              </div>
            ))}
          </div>
          <Link
            href="/tier-selection"
            className="inline-block bg-white text-slate-900 font-black px-8 py-3.5 rounded-full text-sm hover:bg-blue-50 transition-colors"
          >
            See Our Services →
          </Link>
        </div>
      </section>

      {/* ── Reviews ── */}
      {testimonials.length > 0 && (
        <section className="bg-slate-50 border-y border-border py-16 md:py-20">
          <div className="max-w-5xl mx-auto px-6 md:px-10">
            <h2 className="font-heading text-3xl md:text-4xl font-black text-center text-foreground mb-10">
              What our customers say
            </h2>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3 md:gap-4">
              {testimonials.map((t) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  key={t.id}
                  src={t.url}
                  alt={t.alt ?? "Customer review"}
                  className="w-full h-auto object-cover rounded-xl"
                />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ── FAQ ── */}
      <section className="max-w-3xl mx-auto px-6 md:px-10 py-16 md:py-20">
        <h2 className="font-heading text-3xl md:text-4xl font-black text-center text-foreground mb-10">
          Frequently asked questions
        </h2>
        <div className="flex flex-col gap-3">
          {FAQ.map((item) => (
            <details key={item.q} className="border border-border rounded-xl group overflow-hidden">
              <summary className="flex items-center justify-between px-5 py-4 cursor-pointer list-none select-none font-semibold text-sm text-foreground">
                <span>{item.q}</span>
                <span className="text-primary text-lg font-bold ml-4 shrink-0 group-open:rotate-45 transition-transform duration-150">+</span>
              </summary>
              <div className="px-5 pb-5 text-sm text-muted-foreground leading-relaxed border-t border-border pt-4">
                {item.a}
              </div>
            </details>
          ))}
        </div>
        <div className="mt-8 text-center">
          <Link href="/faq" className="text-sm text-primary font-semibold hover:underline">
            See all FAQs →
          </Link>
        </div>
      </section>

      {/* ── Terms of Service ── */}
      <section className="border-t border-border bg-white py-16 md:py-20">
        <div className="max-w-4xl mx-auto px-6 md:px-10">
          <div className="mb-10 text-center">
            <h2 className="font-heading text-3xl md:text-4xl font-black text-foreground mb-3">
              Terms of Service
            </h2>
            <p className="text-sm text-muted-foreground max-w-xl mx-auto">
              By placing an order you agree to these terms. Key points are summarized below.{" "}
              <Link href="/terms" className="text-primary font-semibold hover:underline">Read the full terms →</Link>
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TOS_HIGHLIGHTS.map((item) => (
              <div key={item.title} className="border border-border rounded-xl p-5">
                <h3 className="font-heading font-black text-sm text-foreground mb-2">{item.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{item.body}</p>
              </div>
            ))}
          </div>
          <div className="mt-8 bg-amber-50 border border-amber-200 rounded-xl p-5 text-sm text-amber-900 leading-relaxed">
            <strong>Important:</strong> All sales are final. Turnaround times are estimates only and are not guaranteed.
            The Card Doc LLC is not responsible for loss or damage during transit. Restoration results vary by card condition.
            By submitting an order, you acknowledge and agree to the full{" "}
            <Link href="/terms" className="font-semibold underline hover:text-amber-700">Terms and Conditions</Link>.
          </div>
        </div>
      </section>

      {/* ── Quick links ── */}
      <section className="bg-slate-50 border-t border-border py-10">
        <div className="max-w-5xl mx-auto px-6 md:px-10">
          <div className="flex flex-wrap justify-center gap-x-8 gap-y-3 text-sm">
            <Link href="/tier-selection" className="text-foreground hover:text-primary font-medium transition-colors">Restoration Pricing</Link>
            <Link href="/prep" className="text-foreground hover:text-primary font-medium transition-colors">PSA Prep Pricing</Link>
            <Link href="/shop" className="text-foreground hover:text-primary font-medium transition-colors">Shop Kits</Link>
            <Link href="/track" className="text-foreground hover:text-primary font-medium transition-colors">Track My Order</Link>
            <Link href="/how-it-works" className="text-foreground hover:text-primary font-medium transition-colors">How It Works</Link>
            <Link href="/faq" className="text-foreground hover:text-primary font-medium transition-colors">FAQ</Link>
            <Link href="/terms" className="text-foreground hover:text-primary font-medium transition-colors">Terms of Service</Link>
            <Link href="/gift-cards" className="text-foreground hover:text-primary font-medium transition-colors">Gift Cards</Link>
            <Link href="/account" className="text-foreground hover:text-primary font-medium transition-colors">My Account</Link>
          </div>
        </div>
      </section>
    </div>
  );
}
