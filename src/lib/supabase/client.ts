"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";
import { supabaseConfig } from "./config";

let client: SupabaseClient<Database> | undefined;
export function createClient() {
  if (!client) {
    const { url, key } = supabaseConfig();
    client = createBrowserClient<Database>(url, key);
  }
  return client!;
}
