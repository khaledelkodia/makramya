declare module "@supabase/ssr" {
  import type { SupabaseClient } from "@supabase/supabase-js";

  type CookieValue = { name: string; value: string };
  type CookieToSet = { name: string; value: string; options?: any };
  type CookieMethods = {
    getAll: () => CookieValue[];
    setAll: (cookies: CookieToSet[]) => void;
  };

  export function createBrowserClient<Database = any>(url: string, key: string, options?: Record<string, unknown>): SupabaseClient<Database>;
  export function createServerClient<Database = any>(url: string, key: string, options: { cookies: CookieMethods; [key: string]: unknown }): SupabaseClient<Database>;
}
