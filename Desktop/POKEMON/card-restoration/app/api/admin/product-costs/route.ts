import { cookies } from "next/headers";
import { getProductCosts, saveProductCosts } from "@/lib/product-costs";
import type { ProductCostsConfig } from "@/lib/product-costs";

async function authed() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
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
