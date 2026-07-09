/*
  Run this SQL once in Supabase SQL Editor to create the support_cases table:

  create table support_cases (
    id uuid primary key default gen_random_uuid(),
    customer_name text not null,
    customer_email text not null,
    subject text not null,
    status text not null default 'open',
    notes text,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
  );
*/

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import { resend, fromEmail, businessName } from "@/lib/resend";

async function checkAuth() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

function shortId(id: string) {
  return id.slice(0, 8).toUpperCase();
}

function statusLabel(status: string) {
  if (status === "in_progress") return "In Progress";
  if (status === "resolved") return "Resolved";
  return "Open";
}

async function sendCaseEmail(opts: {
  to: string;
  customerName: string;
  caseId: string;
  subject: string;
  status: string;
  notes: string | null;
  isNew: boolean;
}) {
  const caseRef = `CASE-${shortId(opts.caseId)}`;
  const headline = opts.isNew
    ? `We've opened a support case for you`
    : `Update on your support case`;
  const statusBadge = statusLabel(opts.status);

  await resend.emails.send({
    from: fromEmail,
    to: opts.to,
    subject: `[${caseRef}] ${opts.subject} — ${businessName} Support`,
    html: `
      <div style="font-family:sans-serif;max-width:560px;margin:0 auto;color:#111;">
        <div style="background:#1a8fe0;padding:24px 32px;">
          <h1 style="color:#fff;margin:0;font-size:20px;">${businessName} Support</h1>
        </div>
        <div style="padding:32px;">
          <p style="font-size:15px;margin-top:0;">Hi ${opts.customerName},</p>
          <p style="font-size:15px;">${headline}.</p>

          <div style="background:#f5f5f5;border-radius:8px;padding:20px;margin:20px 0;">
            <p style="margin:0 0 8px;font-size:13px;color:#666;text-transform:uppercase;letter-spacing:.08em;">Case Reference</p>
            <p style="margin:0;font-size:18px;font-weight:700;">${caseRef}</p>
            <p style="margin:8px 0 0;font-size:14px;color:#444;">${opts.subject}</p>
          </div>

          <div style="background:#e8f4fd;border-left:4px solid #1a8fe0;padding:12px 16px;border-radius:0 6px 6px 0;margin:16px 0;">
            <span style="font-size:13px;font-weight:600;color:#1a8fe0;">Status: ${statusBadge}</span>
          </div>

          ${opts.notes ? `
          <div style="margin:20px 0;">
            <p style="font-size:13px;color:#666;margin:0 0 8px;text-transform:uppercase;letter-spacing:.08em;">Notes from our team</p>
            <p style="font-size:14px;color:#333;margin:0;white-space:pre-wrap;">${opts.notes}</p>
          </div>` : ""}

          <p style="font-size:14px;color:#555;">We'll send you an update whenever there's new activity on your case. If you have questions, just reply to this email.</p>
          <p style="font-size:14px;color:#555;margin-bottom:0;">— The ${businessName} Team</p>
        </div>
      </div>
    `,
  });
}

export async function GET() {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ cases: data });
}

export async function POST(req: Request) {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { customer_name, customer_email, subject, notes } = body;
  if (!customer_name?.trim() || !customer_email?.trim() || !subject?.trim()) {
    return Response.json({ error: "Name, email, and subject are required" }, { status: 400 });
  }
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_cases")
    .insert({
      customer_name: customer_name.trim(),
      customer_email: customer_email.trim().toLowerCase(),
      subject: subject.trim(),
      notes: notes?.trim() || null,
      status: "open",
    })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  try {
    await sendCaseEmail({
      to: data.customer_email,
      customerName: data.customer_name,
      caseId: data.id,
      subject: data.subject,
      status: data.status,
      notes: data.notes,
      isNew: true,
    });
  } catch (err) {
    console.error("Failed to send support case email:", err);
  }

  return Response.json({ case: data });
}

export async function PATCH(req: Request) {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });

  const admin = createAdminClient();
  const { data, error } = await admin
    .from("support_cases")
    .update({ ...fields, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });

  try {
    await sendCaseEmail({
      to: data.customer_email,
      customerName: data.customer_name,
      caseId: data.id,
      subject: data.subject,
      status: data.status,
      notes: data.notes,
      isNew: false,
    });
  } catch (err) {
    console.error("Failed to send support case update email:", err);
  }

  return Response.json({ case: data });
}
