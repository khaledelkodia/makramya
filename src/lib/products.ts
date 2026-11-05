import type { Product } from "@/lib/types";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { createClient } from "@/lib/supabase/server";
import { withProductPhoto } from "@/lib/store-images";

export const demoProducts: Product[] = [
  { id:"demo-1", slug:"sakina", name:"مكرمية حائط «سَكينة»", category:"مكرميات حائط", description:"قطعة متنفّذة يدوياً من خيوط القطن الطبيعي، بعقد دقيقة وخطوط هادية تدي حيطتك روحها.", price:1850, sale_price:null, image_url:null, style_key:"wall", colors:[{name:"طبيعي",hex:"#d4c3a4"},{name:"رملي",hex:"#b69e7c"},{name:"زيتي",hex:"#73755c"}], sizes:["40 × 60 سم","60 × 90 سم","مقاس مخصوص"], inventory_count:0, track_inventory:false, badge:"الأكثر طلباً", status:"active", sort_order:1, created_at:"", updated_at:"" },
  { id:"demo-2", slug:"zel", name:"ستارة «ضِلّ»", category:"ستائر", description:"ستارة قطنية بخيوط مكرمية رقيقة، بتدخل النور بنعومة وتضيف للمكان لمسة هادية.", price:3200, sale_price:null, image_url:null, style_key:"curtain", colors:[{name:"عاجي",hex:"#eee6d7"},{name:"كتان",hex:"#c7b69c"},{name:"أبيض",hex:"#f5f1e8"}], sizes:["عرض 100 سم","عرض 150 سم","مقاس مخصوص"], inventory_count:0, track_inventory:false, badge:"حسب المقاس", status:"active", sort_order:2, created_at:"", updated_at:"" },
  { id:"demo-3", slug:"shams", name:"مكرمية «شمس»", category:"مكرميات حائط", description:"تكوين دائري متقن بخيوط قطنية طبيعية، قطعة فن صغيرة بتعمل فرق كبير في أي ركن.", price:1450, sale_price:null, image_url:null, style_key:"decor", colors:[{name:"عسلي",hex:"#b78b5f"},{name:"طبيعي",hex:"#d4c3a4"},{name:"طوبي",hex:"#a96548"}], sizes:["قطر 35 سم","قطر 50 سم","مقاس مخصوص"], inventory_count:0, track_inventory:false, badge:"قطعة مميزة", status:"active", sort_order:3, created_at:"", updated_at:"" },
  { id:"demo-4", slug:"ghosn", name:"حامل نبات «غصن»", category:"ديكور منزلي", description:"حامل نبات يدوي من القطن الطبيعي يضيف لمسة خضرا ودفا للمكان.", price:680, sale_price:null, image_url:null, style_key:"decor", colors:[{name:"طبيعي",hex:"#d4c3a4"},{name:"رملي",hex:"#b69e7c"},{name:"طوبي",hex:"#a96548"}], sizes:["قصير","متوسط","طويل"], inventory_count:0, track_inventory:false, badge:"هدية حلوة", status:"active", sort_order:4, created_at:"", updated_at:"" },
  { id:"demo-5", slug:"mawg", name:"مكرمية «موج»", category:"مكرميات حائط", description:"عقد متدرجة مستوحاة من حركة الموج، قطعة مميزة مصنوعة على مهلك من أجود الخيوط.", price:2200, sale_price:null, image_url:null, style_key:"wall", colors:[{name:"طبيعي",hex:"#d4c3a4"},{name:"أزرق بحري",hex:"#657678"},{name:"رملي",hex:"#b69e7c"}], sizes:["50 × 70 سم","70 × 100 سم","مقاس مخصوص"], inventory_count:0, track_inventory:false, badge:"شغل إيدوي", status:"active", sort_order:5, created_at:"", updated_at:"" },
  { id:"demo-6", slug:"lemma", name:"مفرش «لَمّة»", category:"ديكور منزلي", description:"مفرش صغير بعقد مكرمية ناعمة، على الكومود أو طاولة القهوة.", price:950, sale_price:null, image_url:null, style_key:"decor", colors:[{name:"عاجي",hex:"#eee6d7"},{name:"زيتي",hex:"#73755c"},{name:"وردي ترابي",hex:"#c2927f"}], sizes:["قطر 25 سم","قطر 35 سم","مقاس مخصوص"], inventory_count:0, track_inventory:false, badge:"جديد", status:"active", sort_order:6, created_at:"", updated_at:"" },
];

export async function getProducts(): Promise<Product[]> {
  if (!isSupabaseConfigured) return demoProducts.map(withProductPhoto);
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("products").select("*").eq("status", "active").or("track_inventory.eq.false,inventory_count.gt.0").order("sort_order");
    if (!error && data) return data.map(withProductPhoto);
  } catch { /* The storefront can still show the sample collection before Supabase is configured. */ }
  return demoProducts.map(withProductPhoto);
}
