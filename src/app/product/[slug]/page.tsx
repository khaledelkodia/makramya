import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ProductDetail } from "@/components/product-detail";
import { getProducts } from "@/lib/products";

type Props={params:Promise<{slug:string}>};
async function getProduct(slug:string){const products=await getProducts();return products.find(product=>product.slug===slug)}

export async function generateMetadata({params}:Props):Promise<Metadata>{const {slug}=await params;const product=await getProduct(slug);if(!product)return {title:"المنتج غير موجود",robots:{index:false,follow:false}};const image=product.image_url||"/hero.png";return {title:product.name,description:product.description,alternates:{canonical:`/product/${product.slug}`},openGraph:{title:`${product.name} | مكرمية`,description:product.description,url:`/product/${product.slug}`,images:[{url:image,alt:product.name}],type:"website"},twitter:{card:"summary_large_image",title:`${product.name} | مكرمية`,description:product.description,images:[image]}}}

export default async function ProductPage({params}:Props){const {slug}=await params;const product=await getProduct(slug);if(!product)notFound();const origin=(process.env.NEXT_PUBLIC_SITE_URL||"http://localhost:3000").replace(/\/$/,"");const structuredData={"@context":"https://schema.org","@type":"Product","name":product.name,"description":product.description,"image":product.image_url||`${origin}/hero.png`,"sku":product.slug,"category":product.category,"color":product.colors.map(color=>color.name),"size":product.sizes,"brand":{"@type":"Brand","name":"مكرمية"},"offers":{"@type":"Offer","url":`${origin}/product/${product.slug}`,"priceCurrency":"EGP","price":Number(product.price).toFixed(2),"availability":product.track_inventory&&product.inventory_count===0?"https://schema.org/OutOfStock":"https://schema.org/InStock","itemCondition":"https://schema.org/NewCondition","seller":{"@type":"Organization","name":"مكرمية"}}};return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}}/><ProductDetail product={product}/></>}
