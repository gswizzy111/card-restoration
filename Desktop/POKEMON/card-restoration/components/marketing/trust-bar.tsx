export function TrustBar() {
  const stats = [
    { number: "500+", label: "Cards Restored" },
    { number: "5–8 days", label: "Turnaround" },
    { number: "100%", label: "Insured Transit" },
    { number: "4.9★", label: "Customer Rating" },
  ];

  return (
    <section className="bg-primary">
      <div className="max-w-6xl mx-auto px-6 md:px-8 py-10">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s) => (
            <div key={s.label} className="flex flex-col items-center text-center gap-1">
              <span className="font-heading font-black text-3xl md:text-4xl text-white">
                {s.number}
              </span>
              <span className="text-xs font-bold uppercase tracking-widest text-white/60">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
