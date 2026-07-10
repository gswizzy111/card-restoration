import Link from "next/link";

export default function GiftCardSuccessPage() {
  return (
    <div className="min-h-screen bg-gradient-to-b from-green-50 to-white flex items-center justify-center px-6">
      <div className="max-w-md w-full text-center">
        <div className="text-6xl mb-6">🎉</div>
        <h1 className="font-heading text-3xl font-bold text-foreground mb-3">Gift Card Purchased!</h1>
        <p className="text-muted-foreground mb-8">
          The gift card code has been emailed. It can be applied at checkout on any restoration order.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <Link
            href="/gift-cards"
            className="px-6 py-3 bg-primary text-white font-semibold rounded-xl hover:bg-primary/90 transition-colors"
          >
            Buy Another
          </Link>
          <Link
            href="/"
            className="px-6 py-3 bg-secondary text-foreground font-semibold rounded-xl hover:bg-border transition-colors"
          >
            Back to Home
          </Link>
        </div>
      </div>
    </div>
  );
}
