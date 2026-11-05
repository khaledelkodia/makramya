import type { Metadata } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { OrderTracking } from "@/components/order-tracking";
import type { CustomerOrderTracking } from "@/lib/types";

export const metadata:Metadata={title:"متابعة الطلب",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";

export default async function TrackOrderPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const parsed=z.string().uuid().safeParse(id);const shortened=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{11}$/i.test(id);let order:CustomerOrderTracking|null=null;let unavailable=false;
  if(parsed.success||shortened){
    try{
      const supabase=await createClient();const result=parsed.success
        ?await supabase.rpc("track_order",{p_order_id:parsed.data})
        :await supabase.rpc("track_order_by_prefix",{p_order_id_prefix:id});
      const {data,error}=result;
      if(error){console.error("Unable to load order tracking. Apply supabase/migrations/202611050001_order_tracking.sql if it has not been run.",error);unavailable=true;}
      else order=data as CustomerOrderTracking|null;
    }
    catch(error){console.error("Unable to initialize order tracking.",error);unavailable=true;}
  }
  return <OrderTracking order={order} unavailable={unavailable}/>;
}
