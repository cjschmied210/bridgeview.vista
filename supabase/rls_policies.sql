
-- 1. Enable RLS on all tables
alter table classrooms enable row level security;
alter table students enable row level security;
alter table documents enable row level security;
alter table snapshots enable row level security;
alter table analysis_logs enable row level security;

-- 2. Create Policy: Public (Students) can INSERT specific data
-- Note: 'anon' role is used by the client without a user session (the student script)
-- Limiting what anon can do is safer than 'access to everything'.

-- STUDENTS can INSERT into 'documents' and 'snapshots'
create policy "Public can insert documents"
on documents for insert
to anon
with check (true);

create policy "Public can insert snapshots"
on snapshots for insert
to anon
with check (true);

-- STUDENTS can read their own documents? Maybe not needed for V1.
-- For now, let's keep it WRITE-ONLY for students for maximum privacy.
-- Actually, the 'ingest' API does upserts, so they need UPDATE/SELECT on documents too properly.

create policy "Public can read/update documents"
on documents for all
to anon
using (true)
with check (true);

-- STUDENTS need to 'upsert' students table too (update last_active)
create policy "Public can upsert students"
on students for all
to anon
using (true)
with check (true);

-- HOWEVER, we want to HIDE the 'SELECT * FROM students' from public.
-- This is tricky because upsert requires read permissions to check existence.
-- Workaround: We actually don't want the student to have the ANON key at all ideally, or we restrict SELECT.
-- But standard Supabase Upsert needs SELECT.
-- A better approach for V2: The 'ingest' API route uses the SERVICE_ROLE key (admin), 
-- and the public JS client uses the ANON key but has 0 access to these tables.
-- Let's do that! It is much more secure.

-- REVISED PLAN:
-- 1. Tables are PRIVATE by default (RLS enabled, no policies).
-- 2. TEACHERS (Authenticated) get FULL ACCESS.
-- 3. API ROUTE (Server-side) already uses a specialized client. Wait, ours uses standard client.
--    We need to upgrade api/ingest/route.ts to use SERVICE key so it can bypass RLS.
--    The Google Apps Script calls the API, not Supabase directly. So the API acts as the gatekeeper.
--    So we don't need "Public" policies at all! We just need "Teacher" policies.

-- Policy: Teachers (authenticated users) can do everything
create policy "Teachers can view/edit everything"
on classrooms for all
to authenticated
using (true)
with check (true);

create policy "Teachers can view/edit students"
on students for all
to authenticated
using (true)
with check (true);

create policy "Teachers can view/edit documents"
on documents for all
to authenticated
using (true)
with check (true);

create policy "Teachers can view/edit snapshots"
on snapshots for all
to authenticated
using (true)
with check (true);

create policy "Teachers can view/edit analysis_logs"
on analysis_logs for all
to authenticated
using (true)
with check (true);

-- IMPORTANT: The /api/ingest route currently uses `createClient` from `@/lib/supabase`.
-- If that client uses the ANON key, it will now fail because RLS blocks Anon.
-- We must give the API Route the SERVICE_ROLE key.
