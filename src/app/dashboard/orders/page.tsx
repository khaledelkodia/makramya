import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { OrdersManager } from "@/components/orders-manager";

export const metadata:Metadata={title:"الطلبات"};
export default async function OrdersPage(){const {supabase}=await requireAdmin(["owner","manager","orders"]);const {data:orders}=await supabase.from("orders").select("*").order("created_at",{ascending:false}).limit(500);const ids=(orders||[]).map(order=>order.id);const {data:items}=ids.length?await supabase.from("order_items").select("*").in("order_id",ids):{data:[]};return <section className="dashboard-content"><OrdersManager orders={orders||[]} items={items||[]}/></section>}
