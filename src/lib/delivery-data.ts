import "server-only";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { defaultDeliverySettings } from "@/lib/delivery";

export async function getDeliverySettings() {
  if (!isSupabaseConfigured) return defaultDeliverySettings;
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("delivery_settings").select("id,base_fee,free_shipping_threshold,min_delivery_days,max_delivery_days,coverage_area,customer_note,updated_at").eq("id", "default").maybeSingle();
    if (error || !data) return defaultDeliverySettings;
    return {
      ...data,
      base_fee: Number(data.base_fee),
      free_shipping_threshold: data.free_shipping_threshold === null ? null : Number(data.free_shipping_threshold),
      updated_by: null,
    };
  } catch {
    return defaultDeliverySettings;
  }
}
