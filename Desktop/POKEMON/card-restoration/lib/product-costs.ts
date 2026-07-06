import { createAdminClient } from "@/lib/supabase/admin";

const BUCKET = "app-config";
const FILE = "product-costs.json";

export interface ProductComponent {
  name: string;
  cost_cents: number;
}

export interface ProductCostEntry {
  components: ProductComponent[];
  cost_cents: number;
}

export interface RestorationCosts {
  regular_cents: number;
  expedited_cents: number;
  premium_cents: number;
  ultra_premium_cents: number;
}

export interface ComponentPreset {
  id: string;
  name: string;
  components: ProductComponent[];
}

export interface ProductCostsConfig {
  products: Record<string, ProductCostEntry>;
  restoration: RestorationCosts;
  presets: ComponentPreset[];
}

const DEFAULT: ProductCostsConfig = {
  products: {},
  restoration: { regular_cents: 0, expedited_cents: 0, premium_cents: 0, ultra_premium_cents: 0 },
  presets: [],
};

async function ensureBucket(admin: ReturnType<typeof createAdminClient>) {
  await admin.storage.createBucket(BUCKET, { public: false }).catch(() => {});
}

export async function getProductCosts(): Promise<ProductCostsConfig> {
  const admin = createAdminClient();
  await ensureBucket(admin);
  const { data, error } = await admin.storage.from(BUCKET).download(FILE);
  if (error || !data) return DEFAULT;
  try {
    const parsed = JSON.parse(await data.text());
    return {
      products: parsed.products ?? {},
      restoration: { ...DEFAULT.restoration, ...(parsed.restoration ?? {}) },
      presets: parsed.presets ?? [],
    };
  } catch {
    return DEFAULT;
  }
}

export async function saveProductCosts(config: ProductCostsConfig): Promise<void> {
  const admin = createAdminClient();
  await ensureBucket(admin);
  const blob = new Blob([JSON.stringify(config, null, 2)], { type: "application/json" });
  await admin.storage.from(BUCKET).upload(FILE, blob, { upsert: true, contentType: "application/json" });
}
