-- Customer support logins: a third kind of admin sign-in, next to admins
-- (admin_users) and accountants (accountant_access). Support staff sign in
-- with their email and see order lookup, cases and email problems only
-- (middleware.ts, lib/admin-auth.ts). They are deliberately NOT in
-- admin_users, so neither site's admin username login can ever let them in
-- as a full admin.

create table if not exists public.support_access (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  email text not null unique check (email = lower(email)),
  password_hash text,
  invite_token text unique,
  invite_token_expires_at timestamptz,
  created_at timestamptz not null default now(),
  last_login_at timestamptz
);
alter table public.support_access enable row level security;

-- Sessions: role 'support' with its own owner column
alter table public.admin_sessions
  add column if not exists support_id uuid references public.support_access(id) on delete cascade;
alter table public.admin_sessions drop constraint if exists admin_sessions_role_check;
alter table public.admin_sessions add constraint admin_sessions_role_check
  check (role = any (array['admin'::text, 'accountant'::text, 'support'::text]));
alter table public.admin_sessions drop constraint if exists admin_sessions_check;
alter table public.admin_sessions add constraint admin_sessions_check check (
  (role = 'admin' and admin_user_id is not null and accountant_id is null and support_id is null)
  or (role = 'accountant' and accountant_id is not null and admin_user_id is null and support_id is null)
  or (role = 'support' and support_id is not null and admin_user_id is null and accountant_id is null)
);

-- Forgot-password links for support staff
alter table public.admin_password_resets
  add column if not exists support_id uuid references public.support_access(id) on delete cascade;
alter table public.admin_password_resets drop constraint if exists admin_password_resets_one_owner;
alter table public.admin_password_resets add constraint admin_password_resets_one_owner
  check (num_nonnulls(admin_user_id, accountant_id, support_id) = 1);

-- Who wrote each case note (an admin's username or a support member's name),
-- so replies from people in training can be checked
alter table public.case_notes add column if not exists author text;
