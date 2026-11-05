import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { defaultDeliverySettings } from "@/lib/delivery";
import { DeliverySettingsForm } from "@/components/delivery-settings-form";
import type { DeliverySettings } from "@/lib/types";

export const metadata:Metadata={title:"إعدادات التوصيل"};

export default async function DeliveryPage(){
  const {supabase}=await requireAdmin(["owner","manager","orders"]);
  const {data,error}=await supabase.from("delivery_settings").select("id,base_fee,delivery_zones,free_shipping_threshold,min_delivery_days,max_delivery_days,coverage_area,customer_note,allow_reference_image,updated_at").eq("id","default").maybeSingle();
  const setupMessage=error?"شغّلي ترحيل إعدادات التوصيل وصور العملاء 202611050004 و202611050005 و202611050009 في SQL Editor، وبعدها أعيدي تحميل الصفحة.":undefined;
  const settings=(data?{
    ...data,
    base_fee:Number(data.base_fee),
    delivery_zones:data.delivery_zones.map(zone=>({...zone,fee:Number(zone.fee)})),
    free_shipping_threshold:data.free_shipping_threshold===null?null:Number(data.free_shipping_threshold),
    updated_by:null,
  }:defaultDeliverySettings) as DeliverySettings;
  return <DeliverySettingsForm settings={settings} setupMessage={setupMessage}/>;
}
