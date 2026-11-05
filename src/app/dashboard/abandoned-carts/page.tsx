import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { AbandonedCartsManager } from "@/components/abandoned-carts-manager";

export const metadata:Metadata={title:"السلات المتروكة"};
export default async function AbandonedCartsPage(){
  const {supabase}=await requireAdmin(["owner","manager","orders"]);
  const {data}=await supabase.from("customer_carts").select("*").order("updated_at",{ascending:false}).limit(300);
  return <section className="dashboard-content"><AbandonedCartsManager carts={data||[]}/></section>;
}
