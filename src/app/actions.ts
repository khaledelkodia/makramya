"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { requireAdmin } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { categories } from "@/lib/categories";
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

export async function updateProduct(formData:FormData):Promise<{ok:boolean;error?:string;warning?:string}> {
  const {supabase}=await requireAdmin(["owner","manager","products"]);
  const productId=z.string().uuid().safeParse(formData.get("product_id"));
  if(!productId.success)return {ok:false,error:"المنتج المطلوب غير صحيح."};
  const parsed=productSchema.safeParse(Object.fromEntries(formData));
  if(!parsed.success)return {ok:false,error:"راجعي البيانات؛ في خانة ناقصة أو غير صحيحة."};
  const data=parsed.data;
  const colors: {name:string;hex:string}[]=[];
  const sizes=data.sizes.split(",").map(item=>item.trim()).filter(Boolean);
  if(!data.colors.split(",").some(item=>item.trim())||!sizes.length)return {ok:false,error:"أضيفي لون ومقاس واحد على الأقل."};
  const {data:existing,error:readError}=await supabase.from("products").select("slug,image_url,colors").eq("id",productId.data).maybeSingle();
  if(readError||!existing)return {ok:false,error:"مش قادرين نوصل للمنتج المطلوب."};
  const previousColors=Array.isArray(existing.colors)?existing.colors as {name:string;hex:string}[]:[];
  const palette=["#d4c3a4","#b69e7c","#73755c","#c2927f"];
  for(const [index,item] of data.colors.split(",").entries()){
    const name=item.trim();
    if(name)colors.push({name,hex:previousColors.find(color=>color.name===name)?.hex||palette[index%palette.length]});
  }

  let imageUrl=existing.image_url;
  let uploadedPath:string|null=null;
  const image=formData.get("image");
  if(image instanceof File&&image.size){
    if(!["image/jpeg","image/png","image/webp"].includes(image.type)||image.size>5*1024*1024)return {ok:false,error:"الصورة لازم تكون JPG أو PNG أو WebP وأقل من 5 ميجابايت."};
    const extension=image.type==="image/png"?"png":image.type==="image/webp"?"webp":"jpg";
    uploadedPath=`${crypto.randomUUID()}.${extension}`;
    const {error:uploadError}=await supabase.storage.from("products").upload(uploadedPath,new Uint8Array(await image.arrayBuffer()),{contentType:image.type,upsert:false});
    if(uploadError)return {ok:false,error:"تعذر رفع الصورة الجديدة. راجعي صلاحيات التخزين."};
    imageUrl=supabase.storage.from("products").getPublicUrl(uploadedPath).data.publicUrl;
  }

  const {error:updateError}=await supabase.from("products").update({
    name:data.name,category:data.category,description:data.description,price:data.price,style_key:data.style_key,
    badge:data.badge||null,colors,sizes,inventory_count:data.inventory_count,track_inventory:data.track_inventory,
    image_url:imageUrl,updated_at:new Date().toISOString(),
  }).eq("id",productId.data);
  if(updateError){if(uploadedPath)await supabase.storage.from("products").remove([uploadedPath]);return {ok:false,error:"تعذر حفظ تعديلات المنتج."};}

  let warning:string|undefined;
  const marker="/storage/v1/object/public/products/";
  if(uploadedPath&&existing.image_url?.includes(marker)){
    const oldPath=decodeURIComponent(existing.image_url.split(marker)[1].split("?")[0]);
    const {error:removeError}=await supabase.storage.from("products").remove([oldPath]);
    if(removeError)warning="اتحدّثت بيانات المنتج والصورة الجديدة، لكن الصورة القديمة ما اتحذفتش من التخزين.";
  }
  revalidatePath("/");revalidatePath("/categories");revalidatePath("/dashboard/products");revalidatePath("/product/[slug]","page");
  for(const category of categories)revalidatePath(`/category/${category.slug}`);
  return {ok:true,warning};
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
  const allowed: OrderStatus[] = ["new","confirmed","in_progress","shipped","completed","cancelled"];
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

const categorySlugSchema=z.enum(["macrame","curtains","home-decor"]);
const categoryDetailsSchema=z.object({
  slug:categorySlugSchema,
  name:z.string().trim().min(2).max(80),
  english:z.string().trim().min(2).max(60),
  description:z.string().trim().min(5).max(300),
});
const categoryImageMarker="/storage/v1/object/public/products/";
function getStoredCategoryImagePath(imageUrl:string|null|undefined){
  if(!imageUrl?.includes(categoryImageMarker))return null;
  try{return decodeURIComponent(imageUrl.split(categoryImageMarker)[1].split("?")[0]);}catch{return null;}
}
function refreshCategoryPages(){
  revalidatePath("/");revalidatePath("/categories");revalidatePath("/dashboard/categories");revalidatePath("/dashboard/products");revalidatePath("/product/[slug]","page");
  for(const category of categories)revalidatePath(`/category/${category.slug}`);
}

export async function saveCategoryDetails(formData:FormData):Promise<{ok:boolean;error?:string}> {
  const {supabase}=await requireAdmin(["owner","manager","products"]);
  const parsed=categoryDetailsSchema.safeParse({
    slug:formData.get("slug"),
    name:formData.get("name"),
    english:formData.get("english"),
    description:formData.get("description"),
  });
  if(!parsed.success)return {ok:false,error:"راجعي البيانات؛ الاسم والوصف مطلوبان وبالطول المحدد."};
  const {slug,name,english,description}=parsed.data;
  const {error}=await supabase.rpc("update_store_category",{p_slug:slug,p_name:name,p_english:english,p_description:description});
  if(error){
    if(error.message.toLowerCase().includes("unique"))return {ok:false,error:"فيه صنف تاني بنفس الاسم؛ اختاري اسم مختلف."};
    if(error.message.toLowerCase().includes("update_store_category")||error.code==="PGRST202")return {ok:false,error:"شغّلي ترحيل تعديل الأصناف في Supabase أولاً."};
    return {ok:false,error:"تعذر حفظ بيانات الصنف. راجعي صلاحيات قاعدة البيانات."};
  }
  refreshCategoryPages();
  return {ok:true};
}

export async function saveCategoryImage(formData:FormData):Promise<{ok:boolean;error?:string;warning?:string}> {
  const {supabase,user}=await requireAdmin(["owner","manager","products"]);
  const parsedSlug=categorySlugSchema.safeParse(formData.get("slug"));
  const image=formData.get("image");
  if(!parsedSlug.success)return {ok:false,error:"الصنف المحدد غير صحيح."};
  if(!(image instanceof File)||!image.size)return {ok:false,error:"اختاري صورة للصنف أولاً."};
  if(!["image/jpeg","image/png","image/webp"].includes(image.type)||image.size>5*1024*1024)return {ok:false,error:"الصورة لازم تكون JPG أو PNG أو WebP وأقل من 5 ميجابايت."};

  const slug=parsedSlug.data;
  const {data:existing,error:readError}=await supabase.from("category_images").select("image_url").eq("slug",slug).maybeSingle();
  if(readError)return {ok:false,error:"شغّلي ترحيل صور الأصناف في Supabase أولاً."};
  const extension=image.type==="image/png"?"png":image.type==="image/webp"?"webp":"jpg";
  const path=`categories/${slug}/${crypto.randomUUID()}.${extension}`;
  const {error:uploadError}=await supabase.storage.from("products").upload(path,new Uint8Array(await image.arrayBuffer()),{contentType:image.type,upsert:false});
  if(uploadError)return {ok:false,error:"تعذر رفع الصورة. تأكدي من صلاحيات التخزين وحجم الملف."};
  const imageUrl=supabase.storage.from("products").getPublicUrl(path).data.publicUrl;
  const {error:saveError}=await supabase.from("category_images").upsert({slug,image_url:imageUrl,updated_by:user.id,updated_at:new Date().toISOString()},{onConflict:"slug"});
  if(saveError){await supabase.storage.from("products").remove([path]);return {ok:false,error:"تعذر حفظ الصورة للصنف."};}

  let warning:string|undefined;
  const oldPath=getStoredCategoryImagePath(existing?.image_url);
  if(oldPath&&oldPath!==path){const {error}=await supabase.storage.from("products").remove([oldPath]);if(error)warning="اتحدّثت صورة الصنف، لكن النسخة القديمة ما اتحذفتش من التخزين.";}
  refreshCategoryPages();
  return {ok:true,warning};
}

export async function removeCategoryImage(slug:string):Promise<{ok:boolean;error?:string;warning?:string}> {
  const {supabase}=await requireAdmin(["owner","manager","products"]);
  const parsedSlug=categorySlugSchema.safeParse(slug);
  if(!parsedSlug.success)return {ok:false,error:"الصنف المحدد غير صحيح."};
  const {data:existing,error:readError}=await supabase.from("category_images").select("image_url").eq("slug",parsedSlug.data).maybeSingle();
  if(readError)return {ok:false,error:"تعذر قراءة صورة الصنف."};
  const {error:deleteError}=await supabase.from("category_images").delete().eq("slug",parsedSlug.data);
  if(deleteError)return {ok:false,error:"تعذر إزالة صورة الصنف."};
  const path=getStoredCategoryImagePath(existing?.image_url);
  let warning:string|undefined;
  if(path){const {error}=await supabase.storage.from("products").remove([path]);if(error)warning="اتشالت الصورة من الصنف، لكن الملف فضل في التخزين.";}
  refreshCategoryPages();
  return {ok:true,warning};
}
