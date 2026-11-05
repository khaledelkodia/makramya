import type { Metadata } from "next";
import { Storefront } from "@/components/storefront";
import { getCategories } from "@/lib/category-data";
import { getProducts } from "@/lib/products";

export const metadata:Metadata={title:"الأصناف",description:"تصفحي أصناف مكرمية اليدوية: مكرميات حائط، ستائر، وقطع ديكور منزلي معمولة بحب.",alternates:{canonical:"/categories"},openGraph:{title:"أصناف مكرمية اليدوية",description:"اختاري من مكرميات الحائط والستائر والديكور المنزلي.",url:"/categories",type:"website"}};
export default async function CategoriesPage(){const [products,categories]=await Promise.all([getProducts(),getCategories()]);return <Storefront products={products} categories={categories} categoryIndex/>}
