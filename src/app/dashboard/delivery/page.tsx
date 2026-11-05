import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { defaultDeliverySettings } from "@/lib/delivery";
import { DeliverySettingsForm } from "@/components/delivery-settings-form";
import type { DeliverySettings } from "@/lib/types";

export const metadata:Metadata={title:"إعدادات التوصيل"};

export default async function DeliveryPage(){
  const {supabase}=await requireAdmin(["owner","manager","orders"]);
  const {data,error}=await supabase.from("delivery_settings").select("id,base_fee,free_shipping_threshold,min_delivery_days,max_delivery_days,coverage_area,customer_note,updated_at").eq("id","default").maybeSingle();
  const setupMessage=error?"شغّلي ملف supabase/migrations/202611050004_delivery_settings.sql في SQL Editor في Supabase، ثم أعيدي تحميل الصفحة.":undefined;
  const settings=(data?{
    ...data,
    base_fee:Number(data.base_fee),
    free_shipping_threshold:data.free_shipping_threshold===null?null:Number(data.free_shipping_threshold),
    updated_by:null,
  }:defaultDeliverySettings) as DeliverySettings;
  return <DeliverySettingsForm settings={settings} setupMessage={setupMessage}/>;
}
