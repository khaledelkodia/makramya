"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { OrderStatus, StaffRole } from "@/lib/types";

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
  const { supabase } = await requireAdmin(["owner", "manager", "products"]);
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
  const { supabase } = await requireAdmin(["owner", "manager", "products"]);
  const { error } = await supabase.from("products").update({ status, updated_at:new Date().toISOString() }).eq("id",id);
  if (error) return { ok:false, error:"تعذر تحديث المنتج." };
  revalidatePath("/"); revalidatePath("/dashboard/products"); return { ok:true };
}

export async function deleteProduct(id: string) {
  const { supabase } = await requireAdmin(["owner", "manager", "products"]);
  const productId = z.string().uuid().safeParse(id);
  if (!productId.success) return { ok:false, error:"المنتج المطلوب غير صحيح." };
  const { data: product } = await supabase.from("products").select("image_url").eq("id",productId.data).maybeSingle();
  const { error } = await supabase.from("products").delete().eq("id",productId.data);
  if (error) return { ok:false, error:"تعذر حذف المنتج." };
  let warning: string | undefined;
  const marker = "/storage/v1/object/public/products/";
  const imageUrl = product?.image_url;
  if (imageUrl?.includes(marker)) {
    const path = decodeURIComponent(imageUrl.split(marker)[1].split("?")[0]);
    const { error: imageError } = await supabase.storage.from("products").remove([path]);
    if (imageError) warning = "اتحذف المنتج، لكن الصورة القديمة ما اتحذفتش من التخزين.";
  }
  revalidatePath("/"); revalidatePath("/dashboard/products"); return { ok:true, warning };
}

export async function setOrderStatus(id: string, status: OrderStatus) {
  const { supabase } = await requireAdmin(["owner", "manager", "orders"]);
  const allowed: OrderStatus[] = ["new","confirmed","in_progress","shipped","completed"];
  if (!allowed.includes(status)) return { ok:false, error:"حالة الطلب غير صحيحة." };
  const { error } = await supabase.from("orders").update({ status, updated_at:new Date().toISOString() }).eq("id",id);
  if (error) return { ok:false, error:"تعذر تحديث الطلب." };
  revalidatePath("/dashboard"); revalidatePath("/dashboard/orders"); return { ok:true };
}

const staffRoleSchema = z.enum(["owner", "manager", "products", "orders"]);
const staffUserSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(12).max(128),
  role: staffRoleSchema,
});

function serviceSetupError() {
  return { ok:false as const, error:"إعداد إدارة المستخدمين ناقص. أضيفي SUPABASE_SERVICE_ROLE_KEY في إعدادات Vercel ثم أعيدي النشر." };
}

export async function createStaffUser(formData: FormData): Promise<{ ok:boolean; error?:string }> {
  await requireAdmin(["owner"]);
  const parsed = staffUserSchema.safeParse({
    email: String(formData.get("email") || "").trim().toLowerCase(),
    password: String(formData.get("password") || ""),
    role: formData.get("role"),
  });
  if (!parsed.success) return { ok:false, error:"راجعي البريد وكلمة المرور؛ كلمة المرور لازم تكون 12 حرفاً على الأقل." };

  let service;
  try { service = createServiceClient(); } catch { return serviceSetupError(); }
  const { email, password, role } = parsed.data;
  const { data, error } = await service.auth.admin.createUser({ email, password, email_confirm:true });
  if (error || !data.user) {
    if (error?.message.toLowerCase().includes("already") || error?.code === "email_exists") return { ok:false, error:"البريد ده مستخدم بالفعل." };
    return { ok:false, error:"تعذر إنشاء الحساب. راجعي مفتاح Supabase السري وإعدادات Auth." };
  }

  const { error: roleError } = await service.from("admins").insert({ user_id:data.user.id, role });
  if (roleError) {
    await service.auth.admin.deleteUser(data.user.id);
    if (roleError.code === "42703") return { ok:false, error:"شغّلي ترحيل صلاحيات المستخدمين في Supabase أولاً." };
    return { ok:false, error:"اتعمل الحساب لكن تعذر ربطه بدور المتجر؛ راجعي ترحيل قاعدة البيانات." };
  }

  revalidatePath("/dashboard/users");
  return { ok:true };
}

export async function updateStaffRole(id: string, role: StaffRole): Promise<{ ok:boolean; error?:string }> {
  const { user } = await requireAdmin(["owner"]);
  const userId = z.string().uuid().safeParse(id);
  const parsedRole = staffRoleSchema.safeParse(role);
  if (!userId.success || !parsedRole.success) return { ok:false, error:"بيانات المستخدم أو الدور غير صحيحة." };
  if (userId.data === user.id) return { ok:false, error:"ما ينفعش تغيّري دور حسابك من هنا." };

  let service;
  try { service = createServiceClient(); } catch { return serviceSetupError(); }
  const { data: target, error: targetError } = await service.from("admins").select("user_id, role").eq("user_id",userId.data).maybeSingle();
  if (targetError || !target) return { ok:false, error:"المستخدم مش موجود ضمن فريق المتجر." };
  if (target.role === "owner" && parsedRole.data !== "owner") {
    const { count } = await service.from("admins").select("user_id",{count:"exact",head:true}).eq("role","owner");
    if ((count || 0) <= 1) return { ok:false, error:"لازم يفضل فيه مسؤولة كاملة واحدة على الأقل." };
  }
  const { error } = await service.from("admins").update({ role:parsedRole.data }).eq("user_id",userId.data);
  if (error) return { ok:false, error:"تعذر تحديث صلاحية المستخدم." };
  revalidatePath("/dashboard"); revalidatePath("/dashboard/users");
  return { ok:true };
}

export async function deleteStaffUser(id: string): Promise<{ ok:boolean; error?:string }> {
  const { user } = await requireAdmin(["owner"]);
  const userId = z.string().uuid().safeParse(id);
  if (!userId.success) return { ok:false, error:"المستخدم المطلوب غير صحيح." };
  if (userId.data === user.id) return { ok:false, error:"ما ينفعش تحذفي حسابك الحالي." };

  let service;
  try { service = createServiceClient(); } catch { return serviceSetupError(); }
  const { data: target, error: targetError } = await service.from("admins").select("user_id, role").eq("user_id",userId.data).maybeSingle();
  if (targetError || !target) return { ok:false, error:"المستخدم مش موجود ضمن فريق المتجر." };
  if (target.role === "owner") {
    const { count } = await service.from("admins").select("user_id",{count:"exact",head:true}).eq("role","owner");
    if ((count || 0) <= 1) return { ok:false, error:"ما ينفعش تحذفي آخر مسؤولة كاملة." };
  }
  const { error } = await service.auth.admin.deleteUser(userId.data);
  if (error) return { ok:false, error:"تعذر حذف حساب المستخدم من Supabase Auth." };
  revalidatePath("/dashboard"); revalidatePath("/dashboard/users");
  return { ok:true };
}
