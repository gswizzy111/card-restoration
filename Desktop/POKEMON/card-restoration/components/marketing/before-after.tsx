interface Pair {
  caption: string;
  services: string;
  image?: string;
}

const pairs: Pair[] = [
  {
    caption: "Garchomp X DB46",
    services: "PSA Prep",
    image: "/before-after-garchomp.png",
  },
  { caption: "1986 Fleer Michael Jordan", services: "Full Restoration" },
  { caption: "1952 Topps Mickey Mantle", services: "Full Card Restoration" },
];

export function BeforeAfter() {
  return (
    <section id="before-after" className="py-20 md:py-32 bg-background">
      <div className="max-w-6xl mx-auto px-6 md:px-8">
        <div className="mb-4">
          <p className="text-xs font-bold uppercase tracking-widest text-primary mb-3">Real Results</p>
          <h2 className="font-heading font-black text-4xl md:text-5xl text-foreground">
            Before &amp; After
          </h2>
        </div>
        <p className="text-muted-foreground text-lg mb-14">
          Real cards, real results.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {pairs.map((pair) => (
            <div key={pair.caption} className="flex flex-col gap-3">
              {pair.image ? (
                <img
                  src={pair.image}
                  alt={`Before and after — ${pair.caption}`}
                  className="w-full h-auto rounded-xl border border-border drop-shadow-md"
                />
              ) : (
                <div className="grid grid-cols-2 gap-2">
                  <div className="aspect-[3/4] rounded-lg bg-muted border border-border flex items-center justify-center">
                    <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                      Before
                    </span>
                  </div>
                  <div className="aspect-[3/4] rounded-lg bg-secondary border border-border flex items-center justify-center">
                    <span className="text-xs uppercase tracking-[0.15em] text-muted-foreground">
                      After
                    </span>
                  </div>
                </div>
              )}
              <div>
                <p className="text-sm font-semibold text-foreground">{pair.caption}</p>
                <p className="text-xs text-primary font-bold uppercase tracking-wide">{pair.services}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
