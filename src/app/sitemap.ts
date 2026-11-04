import type { MetadataRoute } from "next";
import { categories } from "@/lib/categories";
import { getProducts } from "@/lib/products";

export default async function sitemap():Promise<MetadataRoute.Sitemap> {
  const origin=(process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000").replace(/\/$/,"");
  const products=await getProducts();
  const paths=[
    {path:"/",priority:1,frequency:"weekly" as const},
    {path:"/categories",priority:.9,frequency:"weekly" as const},
    ...categories.map(category=>({path:`/category/${category.slug}`,priority:.8,frequency:"weekly" as const})),
    ...products.map(product=>({path:`/product/${product.slug}`,priority:.7,frequency:"weekly" as const})),
  ];
  return paths.map(item=>({url:`${origin}${item.path}`,lastModified:new Date(),changeFrequency:item.frequency,priority:item.priority}));
}
