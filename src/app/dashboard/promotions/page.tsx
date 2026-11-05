import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { CouponManager } from "@/components/coupon-manager";

export const metadata:Metadata={title:"العروض والكوبونات"};
export default async function PromotionsPage(){
  const {supabase}=await requireAdmin(["owner","manager"]);
  const {data}=await supabase.from("store_coupons").select("*").order("created_at",{ascending:false});
  return <section className="dashboard-content"><CouponManager coupons={data||[]}/></section>;
}
