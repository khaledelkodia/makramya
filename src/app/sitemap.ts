import type { MetadataRoute } from "next";
import { categories } from "@/lib/categories";
import { getProducts } from "@/lib/products";
import type { Product } from "@/lib/types";

function latestProductUpdate(products:Product[]):Date|undefined {
  const timestamps=products.map(product=>Date.parse(product.updated_at)).filter(Number.isFinite);
  return timestamps.length?new Date(Math.max(...timestamps)):undefined;
}

export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const origin=(process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000").replace(/\/$/,"");
  const products=await getProducts();
  const paths=[
    {path:"/",priority:1,frequency:"weekly" as const,products},
    {path:"/categories",priority:.9,frequency:"weekly" as const,products},
    ...categories.map(category=>({path:`/category/${category.slug}`,priority:.8,frequency:"weekly" as const,products:products.filter(product=>product.category===category.name)})),
    ...products.map(product=>({path:`/product/${product.slug}`,priority:.7,frequency:"weekly" as const,products:[product]})),
  ];
  return paths.map(item=>{
    const lastModified=latestProductUpdate(item.products);
    return {url:`${origin}${item.path}`,...(lastModified?{lastModified}:{}),changeFrequency:item.frequency,priority:item.priority};
  });
}
