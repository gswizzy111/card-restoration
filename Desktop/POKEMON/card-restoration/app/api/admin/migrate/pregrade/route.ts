import { cookies } from "next/headers";

export async function POST() {
  const jar = await cookies();
  if (jar.get("admin_auth")?.value !== process.env.ADMIN_PASSWORD) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY!;

  // Use Supabase's pg_meta endpoint to run raw SQL
  const res = await fetch(`${url}/pg/query`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pregrade_count integer NOT NULL DEFAULT 0;" }),
  });
  const text = await res.text();

  // Also try the REST way — insert into _prisma_migrations won't work, but try schema endpoint
  const res2 = await fetch(`${url}/rest/v1/rpc/exec`, {
    method: "POST",
    headers: { apikey: key, Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({ sql: "ALTER TABLE orders ADD COLUMN IF NOT EXISTS pregrade_count integer NOT NULL DEFAULT 0;" }),
  });
  const text2 = await res2.text();

  return Response.json({ pg_meta: text.slice(0, 200), rpc: text2.slice(0, 200) });
}
