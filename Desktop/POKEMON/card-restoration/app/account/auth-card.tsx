import Link from "next/link";

/** The customer portal's centered card: confirm, forgot and reset password. */
export function AuthCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <Link href="/" className="font-heading font-black text-2xl text-foreground hover:text-primary transition-colors">
            The Card Doc
          </Link>
          <p className="text-muted-foreground text-sm mt-2">Customer portal</p>
        </div>
        <div className="bg-white rounded-2xl border border-border shadow-sm p-6 sm:p-8">
          <h1 className="font-heading font-black text-2xl text-foreground mb-2">{title}</h1>
          {children}
        </div>
      </div>
    </div>
  );
}

export const FIELD_CN = "w-full h-10 border border-border rounded-lg px-3 text-sm focus:outline-none focus:border-primary transition-colors";
export const LABEL_CN = "text-xs font-bold uppercase tracking-wide text-muted-foreground block mb-1.5";
export const BUTTON_CN = "w-full h-11 bg-primary text-primary-foreground font-bold text-sm rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors";
