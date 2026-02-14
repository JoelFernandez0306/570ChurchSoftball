"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";

let browserClient: SupabaseClient | null = null;

export function getBrowserSupabaseClient(): SupabaseClient {
  if (!browserClient) {
    browserClient = createBrowserClient(
      requireEnv("supabaseUrl"),
      requireEnv("supabaseAnonKey"),
    );
  }

  return browserClient;
}
