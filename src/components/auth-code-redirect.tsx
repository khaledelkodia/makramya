"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export function AuthCodeRedirect() {
  useEffect(() => {
    if (window.location.pathname === "/auth/callback") return;
    const currentUrl = new URL(window.location.href);
    const code = currentUrl.searchParams.get("code");
    if (!code) return;

    currentUrl.searchParams.delete("code");
    window.history.replaceState(window.history.state, "", `${currentUrl.pathname}${currentUrl.search}${currentUrl.hash}`);
    if (!isSupabaseConfigured) {
      window.location.replace("/account/login?error=confirmation");
      return;
    }
    void createClient().auth.exchangeCodeForSession(code).then(({ error }) => {
      window.location.replace(error ? "/account/login?error=confirmation" : "/account?confirmed=1");
    }).catch(() => window.location.replace("/account/login?error=confirmation"));
  }, []);

  return null;
}
