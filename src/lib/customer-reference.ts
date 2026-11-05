import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/types";

export const CUSTOMER_REFERENCE_BUCKET="customer-references";
export const CUSTOMER_REFERENCE_MAX_BYTES=5*1024*1024;

export async function uploadCustomerReference(supabase:SupabaseClient<Database>,file:File){
  if(!["image/jpeg","image/png","image/webp"].includes(file.type))throw Object.assign(new Error("اختاري صورة JPG أو PNG أو WebP."),{code:"reference_file_type"});
  if(file.size>CUSTOMER_REFERENCE_MAX_BYTES)throw Object.assign(new Error("حجم الصورة لازم يكون أقل من 5 ميجابايت."),{code:"reference_file_size"});
  const extension=file.type==="image/png"?"png":file.type==="image/webp"?"webp":"jpg";
  const path=`references/${crypto.randomUUID()}.${extension}`;
  const {error}=await supabase.storage.from(CUSTOMER_REFERENCE_BUCKET).upload(path,file,{contentType:file.type,cacheControl:"3600",upsert:false});
  if(error)throw Object.assign(new Error("تعذر رفع الصورة المرجعية. تأكدي من تشغيل ترحيل صور العملاء في Supabase."),{code:"reference_upload_failed"});
  return path;
}
