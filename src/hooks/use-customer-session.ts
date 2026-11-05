"use client";

import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { emptyCustomerProfile, profileFromMetadata, type CustomerProfile } from "@/lib/customer-profile";

export function useCustomerSession() {
  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [signedIn, setSignedIn] = useState(false);
  const [profile, setProfile] = useState<CustomerProfile>(emptyCustomerProfile);

  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    let active = true;
    const syncSession = (session: Session | null) => {
      if (!active) return;
      setUserId(session?.user.id || "");
      setEmail(session?.user.email || "");
      setSignedIn(Boolean(session?.user));
      setProfile(session?.user ? profileFromMetadata(session.user.user_metadata) : emptyCustomerProfile);
    };

    void supabase.auth.getSession().then(({ data }) => syncSession(data.session)).catch(() => undefined);
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => syncSession(session));
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  return { userId, email, signedIn, profile, setProfile };
}
