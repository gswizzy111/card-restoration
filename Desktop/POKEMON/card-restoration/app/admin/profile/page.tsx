import { requireAdmin, getAdminSession } from "@/lib/admin-auth";
import { createAdminClient } from "@/lib/supabase/admin";
import { RecoveryEmailForm, ChangePasswordForm } from "./profile-forms";

export const dynamic = "force-dynamic";

export default async function AdminProfilePage() {
  await requireAdmin();
  const session = (await getAdminSession())!;
  const admin = createAdminClient();
  const { data: user } = await admin
    .from("admin_users")
    .select("email")
    .eq("id", session.adminUserId!)
    .single();

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-2xl mx-auto px-6 py-10 flex flex-col gap-6">
        <div>
          <h1 className="font-heading font-black text-3xl text-foreground">Profile</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Signed in as <span className="font-semibold text-foreground">{session.username}</span>. Your username can&apos;t be changed here.
          </p>
        </div>
        <RecoveryEmailForm initialEmail={user?.email ?? null} />
        <ChangePasswordForm />
      </div>
    </div>
  );
}
