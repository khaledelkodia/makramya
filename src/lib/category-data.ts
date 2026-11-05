import "server-only";
import { categories, type StoreCategory } from "@/lib/categories";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function getCategories():Promise<StoreCategory[]> {
  const fallback=categories.map(category=>({...category,image_url:null}));
  if(!isSupabaseConfigured)return fallback;
  try{
    const supabase=await createClient();
    const [{data:images},{data:details}]=await Promise.all([
      supabase.from("category_images").select("slug,image_url"),
      supabase.from("category_details").select("slug,name,english,description"),
    ]);
    const imageBySlug=new Map((images||[]).map(row=>[row.slug,row.image_url]));
    const detailsBySlug=new Map((details||[]).map(row=>[row.slug,row]));
    return fallback.map(category=>{
      const detail=detailsBySlug.get(category.slug);
      return {...category,...(detail?{name:detail.name,english:detail.english,description:detail.description}:{}),image_url:imageBySlug.get(category.slug)||null};
    });
  }catch{return fallback;}
}
