import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must be added to Env Vars

// Client for Frontend (Respects RLS/Auth)
export const supabase = createClient(supabaseUrl, supabaseKey);

// Client for Admin API Routes (Bypasses RLS)
// Only use this in /app/api/... files, never in components!
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey || supabaseKey);
