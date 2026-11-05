import type { Metadata } from "next";
import { CategoryManager } from "@/components/category-manager";
import { categories } from "@/lib/categories";
import { requireAdmin } from "@/lib/supabase/admin";
import type { StoreCategory } from "@/lib/categories";

export const metadata:Metadata={title:"إدارة الأصناف"};

export default async function CategoryImagesPage(){
  const {supabase}=await requireAdmin(["owner","manager","products"]);
  const [{data:imageRows,error:imageError},{data:detailRows,error:detailError}]=await Promise.all([
    supabase.from("category_images").select("slug,image_url"),
    supabase.from("category_details").select("slug,name,english,description"),
  ]);
  const images=new Map((imageRows||[]).map(row=>[row.slug,row.image_url]));
  const details=new Map((detailRows||[]).map(row=>[row.slug,row]));
  const storeCategories:StoreCategory[]=categories.map(category=>{
    const detail=details.get(category.slug);
    return {...category,...(detail?{name:detail.name,english:detail.english,description:detail.description}:{}),image_url:images.get(category.slug)||null};
  });
  const setupMessage=detailError?"شغّلي ترحيل تعديل الأصناف 202611050003_category_editing.sql في Supabase أولاً.":imageError?"شغّلي ترحيل صور الأصناف 202611050002_category_images.sql في Supabase أولاً.":undefined;
  return <section className="dashboard-content"><CategoryManager categories={storeCategories} setupMessage={setupMessage}/></section>;
}
