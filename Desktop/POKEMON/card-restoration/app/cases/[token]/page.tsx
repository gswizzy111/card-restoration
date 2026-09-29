import { createAdminClient } from "@/lib/supabase/admin";
import { notFound } from "next/navigation";
import { ComplaintForm } from "./complaint-form";

export const dynamic = "force-dynamic";

export default async function CustomerComplaintPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createAdminClient();

  const { data: c } = await admin
    .from("cases")
    .select("id, title, customer_name, customer_complaint, complaint_submitted_at, status")
    .eq("token", token)
    .single();

  if (!c) notFound();

  const alreadySubmitted = !!c.complaint_submitted_at;

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-12 px-4 pb-16">
      <div className="w-full max-w-lg">

        <div className="text-center mb-8">
          <p className="text-2xl font-black text-gray-900">The Card Doc</p>
          <p className="text-sm text-gray-500 mt-1">Customer Support</p>
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="px-6 py-5 border-b border-gray-100 bg-gray-50">
            <p className="text-xs font-bold uppercase tracking-widest text-gray-400 mb-1">Support Case</p>
            <h1 className="font-black text-xl text-gray-900">{c.title}</h1>
            {c.customer_name && (
              <p className="text-sm text-gray-500 mt-0.5">Hi {c.customer_name.split(" ")[0]},</p>
            )}
          </div>

          {alreadySubmitted ? (
            <div className="px-6 py-8 text-center">
              <div className="text-4xl mb-3">✅</div>
              <p className="font-black text-lg text-gray-900 mb-2">We received your complaint</p>
              <p className="text-sm text-gray-500 leading-relaxed">
                Thank you for reaching out. Our team will review your case and respond within <strong>3 business days</strong>.
                We&apos;ll be in touch by email.
              </p>
            </div>
          ) : (
            <div className="px-6 py-6">
              <p className="text-sm text-gray-600 mb-5 leading-relaxed">
                Please describe your complaint or concern in as much detail as possible. Our team reviews all submissions
                and will respond within <strong>3 business days</strong>.
              </p>
              <ComplaintForm caseId={c.id} token={token} />
            </div>
          )}
        </div>

        <p className="text-center text-xs text-gray-400 mt-6">
          This link was sent to you directly by The Card Doc team. It is not publicly accessible.
        </p>
      </div>
    </div>
  );
}
