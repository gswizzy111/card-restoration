import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import Link from "next/link";
import { NewCaseForm } from "./new-case-form";

export const dynamic = "force-dynamic";

export default async function NewCasePage() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) redirect("/admin/login");

  return (
    <div className="min-h-screen bg-secondary/30">
      <div className="max-w-2xl mx-auto px-6 py-10">
        <div className="mb-8">
          <Link href="/admin/cases" className="text-sm text-muted-foreground hover:text-primary transition-colors">← Cases</Link>
          <h1 className="font-heading font-black text-3xl text-foreground mt-4">Open New Case</h1>
        </div>
        <NewCaseForm />
      </div>
    </div>
  );
}
