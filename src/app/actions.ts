"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import type { OrderStatus } from "@/lib/types";

export async function loginAdmin(formData: FormData) {
  const email = String(formData.get("email") || "").trim();
  const password = String(formData.get("password") || "");
  if (!email || !password) redirect("/login?error=missing");
  let supabase;
  try { supabase = await createClient(); } catch { redirect("/login?setup=1"); }
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) redirect("/login?error=credentials");
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login?error=credentials");
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) { await supabase.auth.signOut(); redirect("/login?error=unauthorized"); }
  redirect("/dashboard");
}

export async function logoutAdmin() {
  const { supabase } = await requireAdmin();
  await supabase.auth.signOut();
  redirect("/login");
}

const productSchema = z.object({
  name: z.string().trim().min(2).max(120), category: z.string().trim().min(2).max(80),
  description: z.string().trim().max(2000).default(""), price: z.coerce.number().positive().max(10000000),
  style_key: z.enum(["wall","curtain","decor"]), badge: z.string().trim().max(60).optional(),
  colors: z.string().min(1), sizes: z.string().min(1), inventory_count: z.coerce.number().int().min(0).max(100000),
  track_inventory: z.coerce.boolean().default(false),
});

export async function createProduct(formData: FormData): Promise<{ ok: boolean; error?: string }> {
  const { supabase } = await requireAdmin();
  const parsed = productSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { ok:false, error:"راجعي البيانات، في خانة ناقصة أو غير صحيحة." };
  const data = parsed.data;
  const colors = data.colors.split(",").map((item,index) => ({ name:item.trim(), hex:["#d4c3a4","#b69e7c","#73755c","#c2927f"][index%4] })).filter(item=>item.name);
  const sizes = data.sizes.split(",").map(item=>item.trim()).filter(Boolean);
  if (!colors.length || !sizes.length) return { ok:false, error:"أضيفي لون ومقاس واحد على الأقل." };
  let imageUrl: string | null = null;
  const image = formData.get("image");
  if (image instanceof File && image.size) {
    if (!image.type.startsWith("image/") || image.size > 5 * 1024 * 1024) return { ok:false, error:"الصورة لازم تكون أقل من 5 ميجابايت." };
    const extension = image.type === "image/png" ? "png" : image.type === "image/webp" ? "webp" : "jpg";
    const path = `${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("products").upload(path, new Uint8Array(await image.arrayBuffer()), { contentType:image.type, upsert:false });
    if (uploadError) return { ok:false, error:"تعذر رفع الصورة. تأكدي من تشغيل ترحيل Supabase." };
    imageUrl = supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
  }
  const slug = `${data.name.normalize("NFKD").replace(/[\u0300-\u036f]/g,"").toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"").slice(0,48)||"product"}-${crypto.randomUUID().slice(0,8)}`;
  const { error } = await supabase.from("products").insert({ slug, name:data.name, category:data.category, description:data.description, price:data.price, image_url:imageUrl, style_key:data.style_key, colors, sizes, inventory_count:data.inventory_count, track_inventory:data.track_inventory, badge:data.badge||null, status:"active", sort_order:0 });
  if (error) return { ok:false, error:"تعذر حفظ المنتج في قاعدة البيانات." };
  revalidatePath("/"); revalidatePath("/dashboard"); revalidatePath("/dashboard/products");
  return { ok:true };
}

export async function setProductStatus(id: string, status: "active"|"draft"|"archived") {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("products").update({ status, updated_at:new Date().toISOString() }).eq("id",id);
  if (error) return { ok:false, error:"تعذر تحديث المنتج." };
  revalidatePath("/"); revalidatePath("/dashboard/products"); return { ok:true };
}

export async function deleteProduct(id: string) {
  const { supabase } = await requireAdmin();
  const { error } = await supabase.from("products").delete().eq("id",id);
  if (error) return { ok:false, error:"تعذر حذف المنتج." };
  revalidatePath("/"); revalidatePath("/dashboard/products"); return { ok:true };
}

export async function setOrderStatus(id: string, status: OrderStatus) {
  const { supabase } = await requireAdmin();
  const allowed: OrderStatus[] = ["new","confirmed","in_progress","shipped","completed"];
  if (!allowed.includes(status)) return { ok:false, error:"حالة الطلب غير صحيحة." };
  const { error } = await supabase.from("orders").update({ status, updated_at:new Date().toISOString() }).eq("id",id);
  if (error) return { ok:false, error:"تعذر تحديث الطلب." };
  revalidatePath("/dashboard"); revalidatePath("/dashboard/orders"); return { ok:true };
}
