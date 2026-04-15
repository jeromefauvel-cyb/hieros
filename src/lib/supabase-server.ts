import { createClient, SupabaseClient } from "@supabase/supabase-js";

let _supabaseAdmin: SupabaseClient | null = null;

// Server-side Supabase client (bypasses RLS, for admin operations only)
// Lazy-initialized to avoid crashing at build time when env vars are missing
export const supabaseAdmin: SupabaseClient = new Proxy({} as SupabaseClient, {
  get(_target, prop) {
    if (!_supabaseAdmin) {
      const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
      const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
      if (!supabaseUrl || !serviceRoleKey) {
        throw new Error("Missing Supabase server environment variables");
      }
      _supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (_supabaseAdmin as any)[prop];
  },
});
