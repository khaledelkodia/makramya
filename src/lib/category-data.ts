import "server-only";
import { categories, type StoreCategory } from "@/lib/categories";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";

export async function getCategories():Promise<StoreCategory[]> {
  const fallback=categories.map(category=>({...category,image_url:null}));
  if(!isSupabaseConfigured)return fallback;
  try{
    const supabase=await createClient();
    const {data,error}=await supabase.from("category_images").select("slug,image_url");
    if(error||!data)return fallback;
    const images=new Map(data.map(row=>[row.slug,row.image_url]));
    return fallback.map(category=>({...category,image_url:images.get(category.slug)||null}));
  }catch{return fallback;}
}
