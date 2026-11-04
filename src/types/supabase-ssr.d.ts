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

declare module "@supabase/auth-js" {
  export type GoTrueClientOptions = Record<string, unknown>;
  export type User = { id: string; email?: string; [key: string]: unknown };
  export type Session = { access_token: string; refresh_token: string; user: User; [key: string]: unknown };
  export type AuthError = Error & { status?: number; code?: string };
  export class AuthClient {
    getClaims(jwt?: string): Promise<{ data: { claims: Record<string, unknown> } | null; error: AuthError | null }>;
    getUser(jwt?: string): Promise<{ data: { user: User | null }; error: AuthError | null }>;
    signInWithPassword(credentials: { email: string; password: string }): Promise<{ data: { user: User | null; session: Session | null }; error: AuthError | null }>;
    signOut(options?: { scope?: "global" | "local" | "others" }): Promise<{ error: AuthError | null }>;
  }
}
