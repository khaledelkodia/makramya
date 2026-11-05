import type { Metadata } from "next";
import { CategoryImageManager } from "@/components/category-image-manager";
import { categories } from "@/lib/categories";
import { requireAdmin } from "@/lib/supabase/admin";
import type { StoreCategory } from "@/lib/categories";

export const metadata:Metadata={title:"صور الأصناف"};

export default async function CategoryImagesPage(){
  const {supabase}=await requireAdmin(["owner","manager","products"]);
  const {data,error}=await supabase.from("category_images").select("slug,image_url");
  const images=new Map((data||[]).map(row=>[row.slug,row.image_url]));
  const storeCategories:StoreCategory[]=categories.map(category=>({...category,image_url:images.get(category.slug)||null}));
  const setupMessage=error?"شغّلي ترحيل صور الأصناف في Supabase قبل رفع الصور.":undefined;
  return <section className="dashboard-content"><CategoryImageManager categories={storeCategories} setupMessage={setupMessage}/></section>;
}
