/** The centered card the admin sign-in, forgot and reset password pages share. */
export function AdminAuthCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-secondary flex items-center justify-center px-4">
      <div className="bg-white rounded-xl border border-border p-8 w-full max-w-sm shadow-sm">
        <p className="font-heading font-black text-2xl text-foreground mb-1">The Card Doc</p>
        {children}
      </div>
    </div>
  );
}

export const ADMIN_INPUT_CN = "h-11 w-full px-4 rounded-lg border border-border text-sm focus:outline-none focus:ring-2 focus:ring-primary/40";
export const ADMIN_BUTTON_CN = "h-11 w-full bg-primary text-white font-bold rounded-lg hover:bg-primary/90 transition-colors disabled:opacity-50";
