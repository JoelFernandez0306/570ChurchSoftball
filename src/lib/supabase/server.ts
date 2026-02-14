import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { CookieOptions } from "@supabase/ssr";
import { requireEnv } from "@/lib/env";

export async function getServerSupabaseClient() {
  const cookieStore = await cookies();

  return createServerClient(requireEnv("supabaseUrl"), requireEnv("supabaseAnonKey"), {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: CookieOptions }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          cookieStore.set(name, value, options);
        });
      },
    },
  });
}
