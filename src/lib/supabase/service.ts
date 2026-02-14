import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

export function getServiceSupabaseClient() {
  const supabaseUrl = requireEnv("supabaseUrl");
  const serviceRoleKey = requireEnv("supabaseServiceRoleKey");

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
