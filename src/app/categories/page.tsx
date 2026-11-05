import type { Metadata } from "next";
import { Storefront } from "@/components/storefront";
import { getCategories } from "@/lib/category-data";
import { getProducts } from "@/lib/products";
import { getDeliverySettings } from "@/lib/delivery-data";

export const revalidate=0;
export async function generateMetadata():Promise<Metadata>{const categories=await getCategories();const description=`تصفحي أصناف مكرمية اليدوية: ${categories.map(category=>category.name).join("، ")}، وكلها معمولة بحب.`;return {title:"الأصناف",description,alternates:{canonical:"/categories"},openGraph:{title:"أصناف مكرمية اليدوية",description,url:"/categories",type:"website"}}}
export default async function CategoriesPage(){const [products,categories,deliverySettings]=await Promise.all([getProducts(),getCategories(),getDeliverySettings()]);return <Storefront products={products} categories={categories} deliverySettings={deliverySettings} categoryIndex/>}
