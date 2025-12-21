import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export const supabaseClient: SupabaseClient = createClient(url, anonKey);

// Server-side admin client factory (for API routes)
export function getAdminSupabase() {
  const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY!;
  if (!serviceRole) throw new Error("SUPABASE_SERVICE_ROLE_KEY is required on server");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, serviceRole);
}
