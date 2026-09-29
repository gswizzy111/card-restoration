import { cookies } from "next/headers";
import { getCheckoutErrors, clearCheckoutErrors } from "@/lib/checkout-error-log";

async function auth() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
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
