import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { Storefront } from "@/components/storefront";
import { categories } from "@/lib/categories";
import { getCategories } from "@/lib/category-data";
import { getProducts } from "@/lib/products";
import { categoryFallbackImages } from "@/lib/store-images";

export const revalidate=0;
export function generateStaticParams(){return categories.map(category=>({slug:category.slug}))}
export async function generateMetadata({params}:{params:Promise<{slug:string}>}):Promise<Metadata>{const {slug}=await params;const category=(await getCategories()).find(item=>item.slug===slug);return category?{title:category.name,description:category.description,alternates:{canonical:`/category/${category.slug}`},openGraph:{title:`${category.name} اليدوية | مكرمية`,description:category.description,url:`/category/${category.slug}`,type:"website"}}:{title:"الصنف غير موجود",robots:{index:false,follow:false}}}
export default async function CategoryPage({params}:{params:Promise<{slug:string}>}){const {slug}=await params;const [products,allCategories]=await Promise.all([getProducts(),getCategories()]);const category=allCategories.find(item=>item.slug===slug);if(!category)notFound();return <Storefront products={products} categories={allCategories} initialCategory={category.name} categoryDescription={category.description} initialCategoryImage={category.image_url||categoryFallbackImages[category.slug]}/>}
