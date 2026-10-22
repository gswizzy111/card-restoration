import { getCheckoutErrors, clearCheckoutErrors } from "@/lib/checkout-error-log";
import { isAdmin } from "@/lib/admin-auth";

async function auth() {
  return isAdmin();
}

export async function GET() {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const errors = await getCheckoutErrors();
  return Response.json({ errors });
}

export async function DELETE() {
  if (!(await auth())) return Response.json({ error: "Unauthorized" }, { status: 401 });
  await clearCheckoutErrors();
  return Response.json({ ok: true });
}
