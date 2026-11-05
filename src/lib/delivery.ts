import type { DeliverySettings } from "@/lib/types";

export const EGYPT_GOVERNORATES = [
  "القاهرة","الجيزة","الإسكندرية","القليوبية","البحيرة","كفر الشيخ","الغربية","المنوفية","الدقهلية",
  "دمياط","بورسعيد","الإسماعيلية","السويس","الشرقية","شمال سيناء","جنوب سيناء","بني سويف",
  "الفيوم","المنيا","أسيوط","سوهاج","قنا","الأقصر","أسوان","البحر الأحمر","الوادي الجديد","مطروح",
] as const;

export const defaultDeliverySettings: DeliverySettings = {
  id: "default",
  base_fee: 0,
  delivery_zones: [{ governorates:[...EGYPT_GOVERNORATES], fee:0 }],
  free_shipping_threshold: null,
  min_delivery_days: 3,
  max_delivery_days: 7,
  coverage_area: "جميع محافظات مصر",
  customer_note: "هنكلمك نأكد تفاصيل التوصيل قبل تجهيز الطلب.",
  updated_by: null,
  updated_at: "",
};

export function calculateDeliveryFee(settings: DeliverySettings, subtotal: number, governorate?:string) {
  const zone=settings.delivery_zones.find(item=>item.governorates.includes(governorate||""));
  if(!zone)return null;
  if (settings.free_shipping_threshold !== null && subtotal >= settings.free_shipping_threshold) return 0;
  return zone.fee;
}

export function deliveryWindow(settings: DeliverySettings) {
  if (settings.min_delivery_days === settings.max_delivery_days) {
    if (settings.min_delivery_days === 1) return "يوم واحد";
    if (settings.min_delivery_days === 2) return "يومين";
    return `${settings.min_delivery_days} أيام`;
  }
  return `من ${settings.min_delivery_days} إلى ${settings.max_delivery_days} أيام`;
}
