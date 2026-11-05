import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { ProductManager } from "@/components/product-manager";
import { getCategories } from "@/lib/category-data";
import { withProductPhoto } from "@/lib/store-images";

export const metadata:Metadata={title:"المنتجات"};
export default async function ProductsPage(){const {supabase}=await requireAdmin(["owner","manager","products"]);const [{data},categories]=await Promise.all([supabase.from("products").select("*").order("created_at",{ascending:false}),getCategories()]);return <section className="dashboard-content"><ProductManager products={(data||[]).map(withProductPhoto)} categories={categories}/></section>}
