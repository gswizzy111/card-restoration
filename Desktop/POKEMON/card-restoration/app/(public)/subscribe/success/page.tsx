import Link from "next/link";

export default function SubscribeSuccessPage() {
  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-border p-10 max-w-md w-full text-center">
        <div className="text-5xl mb-4">🎉</div>
        <h1 className="font-heading font-black text-3xl text-foreground mb-3">
          You&rsquo;re subscribed!
        </h1>
        <p className="text-muted-foreground text-base mb-8">
          Your first kit will ship within 1-2 business days. You&rsquo;ll be billed $62.99 on the
          same day each month.
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-primary px-6 py-3 text-sm font-bold text-primary-foreground hover:opacity-90 transition-opacity"
        >
          Back to home
        </Link>
      </div>
    </div>
  );
}
