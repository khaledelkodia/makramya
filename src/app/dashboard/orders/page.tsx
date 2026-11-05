import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { OrdersManager } from "@/components/orders-manager";

export const metadata:Metadata={title:"الطلبات"};
export default async function OrdersPage(){
  const {supabase}=await requireAdmin(["owner","manager","orders"]);
  const {data:orders}=await supabase.from("orders").select("*").order("created_at",{ascending:false}).limit(500);
  const ids=(orders||[]).map(order=>order.id);
  const [{data:items},{data:history}]=ids.length?await Promise.all([
    supabase.from("order_items").select("*").in("order_id",ids),
    supabase.from("order_status_history").select("*").in("order_id",ids).order("created_at"),
  ]):[{data:[]},{data:[]}];
  const referenceEntries=await Promise.all((orders||[]).filter(order=>order.reference_image_path).map(async order=>{
    const {data}=await supabase.storage.from("customer-references").createSignedUrl(order.reference_image_path!,3600);
    return [order.id,data?.signedUrl||""] as const;
  }));
  const referenceImages=Object.fromEntries(referenceEntries.filter(([,url])=>url));
  return <section className="dashboard-content"><OrdersManager orders={orders||[]} items={items||[]} history={history||[]} referenceImages={referenceImages}/></section>;
}
