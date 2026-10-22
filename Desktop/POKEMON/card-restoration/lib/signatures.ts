import { randomUUID } from "node:crypto";
import type { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { sha256 } from "@/lib/terms-versions";

type Admin = ReturnType<typeof createAdminClient>;

/**
 * Electronic signatures and consents (Terms of Service v1.0, Section 35).
 * Rows are permanent: the database refuses updates and deletes, and sets the
 * signing time itself, so a time sent by the browser can never be recorded.
 * Each row stores the exact text signed and its SHA-256:
 *   - master_terms: sha256(Terms markdown + "\n\n" + document_text), where
 *     document_text is the Key Terms, certification and checked box;
 *   - slab_removal / high_value: sha256(document_text).
 * Its signed PDF lives at signed_pdf_url in the private signed-documents
 * bucket (lib/signed-pdfs.ts) and can be rebuilt from the row at any time.
 */
export type SignatureType = "master_terms" | "slab_removal" | "high_value";

export type SignatureInput = {
  order_id: string;
  order_item_id?: string | null;
  type: SignatureType;
  terms_version_id: string;
  document_title: string;
  document_text: string;
  document_sha256: string;
  card_snapshot?: Record<string, unknown> | null;
  typed_full_name: string;
};

export type SignatureRow = SignatureInput & {
  id: string;
  email: string | null;
  email_verified: boolean;
  signed_at: string;
  ip_address: string | null;
  user_agent: string | null;
  signed_pdf_url: string | null;
};

export const masterDocumentHash = (termsMarkdown: string, documentText: string) => sha256(`${termsMarkdown}\n\n${documentText}`);
export const documentHash = (documentText: string) => sha256(documentText);

/** Where a request came from, kept with what it signed (disclosed in the Privacy Policy). */
export type SigningContext = { ip: string | null; userAgent: string | null; email: string; emailVerified: boolean };

export function requestOrigin(request: Request) {
  return {
    ip: request.headers.get("x-nf-client-connection-ip")
      ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
      ?? null,
    userAgent: request.headers.get("user-agent")?.slice(0, 300) ?? null,
  };
}

/**
 * The signer's email counts as verified when they're signed in to an account
 * whose confirmed email is the order's email (or, for links we email, when
 * they opened the link: pass verified = true).
 */
export async function signingContext(request: Request, email: string, verified?: boolean): Promise<SigningContext> {
  let emailVerified = !!verified;
  if (!emailVerified) {
    try {
      const supabase = await createClient();
      const { data: { user } } = await supabase.auth.getUser();
      emailVerified = !!user?.email_confirmed_at && user.email?.toLowerCase() === email.trim().toLowerCase();
    } catch {
      emailVerified = false;
    }
  }
  return { ...requestOrigin(request), email: email.trim().toLowerCase(), emailVerified };
}

export const signedPdfPath = (orderId: string, signatureId: string) => `${orderId}/${signatureId}.pdf`;

/** Saves signatures in one insert (all or none). Returns the stored rows in the same order. */
export async function recordSignatures(
  admin: Admin,
  inputs: SignatureInput[],
  ctx: SigningContext,
): Promise<{ rows: SignatureRow[] } | { error: string }> {
  if (!inputs.length) return { rows: [] };
  const records = inputs.map((s) => {
    const id = randomUUID();
    return {
      ...s,
      id,
      order_item_id: s.order_item_id ?? null,
      card_snapshot: s.card_snapshot ?? null,
      typed_full_name: s.typed_full_name.trim(),
      email: ctx.email,
      email_verified: ctx.emailVerified,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
      signed_pdf_url: signedPdfPath(s.order_id, id),
    };
  });
  const { data, error } = await admin.from("signatures").insert(records).select("*");
  if (error || !data) {
    console.error("Saving signatures failed:", error?.message);
    return { error: error?.message ?? "no rows returned" };
  }
  const byId = new Map((data as SignatureRow[]).map((r) => [r.id, r]));
  return { rows: records.map((r) => byId.get(r.id)!) };
}

export type ConsentType = "esign_records" | "marketing_media" | "marketing_tag_name" | "subscription";

export async function recordConsents(
  admin: Admin,
  consents: { type: ConsentType; granted: boolean; consent_text: string; order_id?: string | null; subscription_id?: string | null }[],
  ctx: { ip: string | null; userAgent: string | null; email: string },
): Promise<string | null> {
  if (!consents.length) return null;
  const { error } = await admin.from("consents").insert(
    consents.map((c) => ({
      order_id: c.order_id ?? null,
      subscription_id: c.subscription_id ?? null,
      email: ctx.email,
      type: c.type,
      granted: c.granted,
      consent_text: c.consent_text,
      ip_address: ctx.ip,
      user_agent: ctx.userAgent,
    }))
  );
  if (error) {
    console.error("Saving consents failed:", error.message);
    return error.message;
  }
  return null;
}
