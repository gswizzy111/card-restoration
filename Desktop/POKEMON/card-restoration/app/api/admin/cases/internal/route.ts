/*
  Run this SQL once in Supabase SQL Editor to create the internal_cases table:

  create table internal_cases (
    id uuid primary key default gen_random_uuid(),
    title text not null,
    notes text,
    status text not null default 'open',
    due_date date,
    created_at timestamptz not null default now()
  );
*/

import { cookies } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";

async function checkAuth() {
  const jar = await cookies();
  return jar.get("admin_auth")?.value === process.env.ADMIN_PASSWORD;
}

export async function GET() {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("internal_cases")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ cases: data });
}

export async function POST(req: Request) {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { title, notes, due_date } = body;
  if (!title?.trim()) return Response.json({ error: "Title is required" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("internal_cases")
    .insert({ title: title.trim(), notes: notes?.trim() || null, due_date: due_date || null })
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ case: data });
}

export async function PATCH(req: Request) {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const { id, ...fields } = body;
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("internal_cases")
    .update(fields)
    .eq("id", id)
    .select()
    .single();
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ case: data });
}

export async function DELETE(req: Request) {
  if (!await checkAuth()) return Response.json({ error: "Unauthorized" }, { status: 401 });
  const { id } = await req.json();
  if (!id) return Response.json({ error: "id required" }, { status: 400 });
  const admin = createAdminClient();
  const { error } = await admin.from("internal_cases").delete().eq("id", id);
  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ ok: true });
}
