/** The creator portal's centered card: sign-in and password setup. */
export function PortalCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary/30 flex items-center justify-center px-4 py-16">
      <div className="bg-white rounded-2xl border border-border p-8 w-full max-w-sm shadow-sm">
        <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">The Card Doc</p>
        <h1 className="font-heading font-black text-2xl text-foreground mt-1 mb-6">{title}</h1>
        {children}
      </div>
    </div>
  );
}

export const PORTAL_LABEL_CN = "block text-xs font-bold uppercase tracking-widest text-muted-foreground mb-1.5";
export const PORTAL_INPUT_CN = "w-full border border-border rounded-lg px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";
export const PORTAL_BUTTON_CN = "w-full h-11 bg-primary text-primary-foreground font-bold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50";
