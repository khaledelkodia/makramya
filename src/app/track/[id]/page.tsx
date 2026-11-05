import type { Metadata } from "next";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { OrderTracking } from "@/components/order-tracking";
import type { CustomerOrderTracking } from "@/lib/types";

export const metadata:Metadata={title:"متابعة الطلب",robots:{index:false,follow:false}};
export const dynamic="force-dynamic";

export default async function TrackOrderPage({params}:{params:Promise<{id:string}>}){
  const {id}=await params;const parsed=z.string().uuid().safeParse(id);let order:CustomerOrderTracking|null=null;
  if(parsed.success){
    try{const supabase=await createClient();const {data}=await supabase.rpc("track_order",{p_order_id:parsed.data});order=data as CustomerOrderTracking|null;}
    catch{order=null;}
  }
  return <OrderTracking order={order}/>;
}
