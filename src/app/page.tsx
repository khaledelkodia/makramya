import { Storefront } from "@/components/storefront";
import { getProducts } from "@/lib/products";

export const revalidate = 0;

export default async function HomePage() {
  const products = await getProducts();
  const origin = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
  const structuredData = [
    { "@context":"https://schema.org", "@type":"Organization", "@id":`${origin}/#organization`, name:"مكرمية", url:origin, logo:`${origin}/icon.svg`, image:`${origin}/hero.png`, description:"ستائر ومكرميات يدوية معمولة مخصوص ليكي، على المقاس واللون اللي بتحلمي بيه.", knowsLanguage:"ar-EG" },
    { "@context":"https://schema.org", "@type":"WebSite", "@id":`${origin}/#website`, name:"مكرمية", url:origin, inLanguage:"ar-EG", publisher:{"@id":`${origin}/#organization`} },
  ];
  return <><script type="application/ld+json" dangerouslySetInnerHTML={{__html:JSON.stringify(structuredData).replace(/</g,"\\u003c")}}/><Storefront products={products}/></>;
}
