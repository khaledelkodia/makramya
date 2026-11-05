export const categories = [
  { slug:"macrame", name:"مكرميات حائط", english:"WALL MACRAMÉ", description:"تفاصيل من خيوط طبيعية وعقد يدوية تحكي حكاية على حيطتك.", number:"01", style:"wall" },
  { slug:"curtains", name:"ستائر", english:"MACRAMÉ CURTAINS", description:"ضوء هادي، خامات طبيعية، ومقاس متظبط مخصوص لشباكك.", number:"02", style:"curtain" },
  { slug:"home-decor", name:"ديكور منزلي", english:"HOME DETAILS", description:"تفاصيل صغيرة معمولة بإيدينا عشان تدي البيت روح دافية.", number:"03", style:"decor" },
] as const;

export function getCategory(slug:string) { return categories.find(category=>category.slug===slug); }
export type CategorySlug = (typeof categories)[number]["slug"];
export type StoreCategory = {
  slug: CategorySlug;
  name: string;
  english: string;
  description: string;
  number: string;
  style: (typeof categories)[number]["style"];
  image_url: string | null;
};
