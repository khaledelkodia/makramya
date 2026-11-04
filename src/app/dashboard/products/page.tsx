import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { ProductManager } from "@/components/product-manager";

export const metadata:Metadata={title:"المنتجات"};
export default async function ProductsPage(){const {supabase}=await requireAdmin();const {data}=await supabase.from("products").select("*").order("created_at",{ascending:false});return <section className="dashboard-content"><ProductManager products={data||[]}/></section>}
