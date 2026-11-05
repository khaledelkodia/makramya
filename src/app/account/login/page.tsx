import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { CustomerAuthForm } from "@/components/customer-auth-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata:Metadata={title:"حسابي وطلباتي",robots:{index:false,follow:false}};

export default async function CustomerLoginPage({searchParams}:{searchParams:Promise<{email?:string;error?:string}>}){
  const params=await searchParams;
  let signedIn=false;
  if(isSupabaseConfigured){
    try{const supabase=await createClient();const {data:{user}}=await supabase.auth.getUser();signedIn=Boolean(user);}
    catch{}
  }
  if(signedIn)redirect("/account");
  return <main className="login-page customer-login-page"><Link href="/" className="brand"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link><section className="login-card customer-login-card"><span className="eyebrow">مساحتك الخاصة</span><h1>طلباتك <em>في مكان واحد.</em></h1><p>سجّلي دخولك أو أنشئي حسابًا بنفس البريد اللي استخدمتيه عند الطلب.</p>{!isSupabaseConfigured&&<div className="notice-box">إعدادات Supabase غير مكتملة. راجعي ملف README وإعدادات النشر.</div>}{params.error==="confirmation"&&<div className="form-error">تعذر تأكيد البريد. افتحي أحدث رسالة وصلتك وجربي الرابط مرة أخرى.</div>}<CustomerAuthForm initialEmail={params.email||""}/></section><Link className="login-back" href="/categories">كمّلي تسوق <span>←</span></Link></main>;
}
