import { getProductCosts, saveProductCosts } from "@/lib/product-costs";
import type { ProductCostsConfig } from "@/lib/product-costs";
import { isAdmin } from "@/lib/admin-auth";

async function authed() {
  return isAdmin();
}

export async function GET() {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const config = await getProductCosts();
  return Response.json(config);
}

export async function POST(req: Request) {
  if (!await authed()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const config = await req.json() as ProductCostsConfig;
  await saveProductCosts(config);
  return Response.json({ ok: true });
}
