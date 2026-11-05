"use client";

import { useEffect } from "react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { profileToMetadata, type CustomerProfile } from "@/lib/customer-profile";

export function CustomerProfileSync({ profile }:{profile:CustomerProfile}) {
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    const supabase = createClient();
    void supabase.auth.updateUser({ data: profileToMetadata(profile) })
      .then(({ error }) => { if (error) console.error("Unable to save customer contact details.", error); })
      .catch(error => console.error("Unable to save customer contact details.", error));
  }, [profile.address, profile.fullName, profile.governorate, profile.phone]);

  return null;
}
