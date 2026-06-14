export default function HowItWorksPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      {/* Hero Section */}
      <div className="max-w-4xl mx-auto px-6 md:px-10 py-16 md:py-24">
        <h1 className="font-heading text-4xl md:text-5xl text-foreground mb-4">How Card Restoration Works</h1>
        <p className="text-lg text-muted-foreground">
          Understand what we can restore and what limitations we face in bringing your cards back to life.
        </p>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-6 md:px-10 pb-20">
        {/* What We Can Reduce */}
        <section className="mb-16">
          <div className="bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-lg p-8 md:p-10">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-emerald-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <div>
                <h2 className="font-heading text-2xl md:text-3xl text-emerald-900 mb-2">What We Can Restore</h2>
                <p className="text-emerald-800">
                  Our restoration process can significantly reduce or eliminate the following damage:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: "Creases",
                  description: "We can smooth out creases and fold lines using specialized techniques to restore the card's flatness.",
                },
                {
                  title: "Edge Lifts",
                  description: "Lifted edges can be carefully addressed to restore the card's structural integrity.",
                },
                {
                  title: "Dings & Indents",
                  description: "Minor dings and indents can be reduced or removed through our restoration process.",
                },
                {
                  title: "Surface Dirt & Grime",
                  description: "We professionally clean away surface dirt, dust, and grime while protecting the card's original finish.",
                },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-lg p-6 border border-emerald-200">
                  <h3 className="font-heading text-lg font-semibold text-emerald-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-emerald-700">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* What We Cannot Fix */}
        <section>
          <div className="bg-gradient-to-br from-red-50 to-red-100/50 border border-red-200 rounded-lg p-8 md:p-10">
            <div className="flex items-start gap-4 mb-6">
              <div className="w-12 h-12 rounded-full bg-red-500 flex items-center justify-center flex-shrink-0">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </div>
              <div>
                <h2 className="font-heading text-2xl md:text-3xl text-red-900 mb-2">Limitations</h2>
                <p className="text-red-800">
                  Unfortunately, the following types of damage cannot be restored:
                </p>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {[
                {
                  title: "Whitening",
                  description:
                    "Whitening around the edges or corners is permanent. Our restoration cannot restore the original coloring once bleached.",
                },
                {
                  title: "Deep Scratching",
                  description:
                    "Deep scratches that penetrate the card's surface or print cannot be fully repaired. Minor surface scratches may be reduced.",
                },
              ].map((item) => (
                <div key={item.title} className="bg-white rounded-lg p-6 border border-red-200">
                  <h3 className="font-heading text-lg font-semibold text-red-900 mb-2">{item.title}</h3>
                  <p className="text-sm text-red-700">{item.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="mt-16 bg-white border border-border rounded-lg p-8 md:p-10 text-center">
          <h3 className="font-heading text-2xl text-foreground mb-4">Ready to restore your collection?</h3>
          <p className="text-muted-foreground mb-6 max-w-2xl mx-auto">
            Submit your cards for restoration and see the difference professional care can make.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <a
              href="/restoration"
              className="inline-flex items-center justify-center px-6 py-3 bg-primary text-primary-foreground font-semibold rounded-lg hover:bg-primary/90 transition-colors"
            >
              Book Restoration
            </a>
            <a
              href="/shop"
              className="inline-flex items-center justify-center px-6 py-3 border border-primary text-primary font-semibold rounded-lg hover:bg-primary/5 transition-colors"
            >
              Browse Kits
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
