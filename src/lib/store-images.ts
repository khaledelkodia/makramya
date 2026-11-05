import type { CategorySlug } from "@/lib/categories";
import type { Product } from "@/lib/types";

export const categoryFallbackImages:Record<CategorySlug,string>={
  macrame:"/images/categories/macrame.png",
  curtains:"/images/categories/curtains.png",
  "home-decor":"/images/categories/home-decor.png",
};

const productFallbackImages:Record<string,string>={
  "sakina-wall-macrame":"/images/products/sakina-wall-macrame.png",
  sakina:"/images/products/sakina-wall-macrame.png",
  "zel-curtain":"/images/products/zel-curtain.png",
  zel:"/images/products/zel-curtain.png",
  "shams-macrame":"/images/products/shams-round-macrame.png",
  shams:"/images/products/shams-round-macrame.png",
  "kheit-noor-divider":"/images/products/kheit-noor-divider.png",
  "ghosn-plant-hanger":"/images/products/ghosn-plant-hanger.png",
  ghosn:"/images/products/ghosn-plant-hanger.png",
  "mawg-wall-macrame":"/images/products/mawg-wave-macrame.png",
  mawg:"/images/products/mawg-wave-macrame.png",
  "lemma-table-mat":"/images/products/lemma-table-mat.png",
  lemma:"/images/products/lemma-table-mat.png",
  "sabah-curtain":"/images/products/sabah-curtain.png",
};

const styleFallbackImages:Record<Product["style_key"],string>={
  wall:"/images/products/sakina-wall-macrame.png",
  curtain:"/images/products/zel-curtain.png",
  decor:"/images/products/ghosn-plant-hanger.png",
};

export function withProductPhoto(product:Product):Product{
  return {...product,image_url:product.image_url||productFallbackImages[product.slug]||styleFallbackImages[product.style_key]};
}
