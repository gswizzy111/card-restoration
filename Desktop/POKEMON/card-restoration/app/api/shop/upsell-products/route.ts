import { createAdminClient } from "@/lib/supabase/admin";

const CONFIG_BUCKET = "card-photos";
const CONFIG_PATH = "_config/upsell.json";

export async function readUpsellIds(admin: ReturnType<typeof createAdminClient>): Promise<string[]> {
  try {
    const { data, error } = await admin.storage.from(CONFIG_BUCKET).download(CONFIG_PATH);
    if (error || !data) return [];
    const text = await data.text();
    return JSON.parse(text) as string[];
  } catch {
    return [];
  }
}

export async function writeUpsellIds(admin: ReturnType<typeof createAdminClient>, ids: string[]) {
  const blob = new Blob([JSON.stringify(ids)], { type: "application/json" });
  await admin.storage.from(CONFIG_BUCKET).update(CONFIG_PATH, blob, {
    contentType: "application/json",
    upsert: true,
  });
}

export async function GET() {
  const admin = createAdminClient();
  const ids = await readUpsellIds(admin);
  if (ids.length === 0) return Response.json({ products: [] });

  const { data } = await admin
    .from("products")
    .select("id, name, slug, description, price_cents, images, inventory_count")
    .in("id", ids)
    .eq("active", true)
    .gt("inventory_count", 0)
    .order("display_order", { ascending: true });

  return Response.json({ products: data ?? [] });
}
