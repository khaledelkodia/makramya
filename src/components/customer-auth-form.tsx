"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { emptyCustomerProfile, profileToMetadata, type CustomerProfile } from "@/lib/customer-profile";

type Mode = "signin" | "signup";

export function CustomerAuthForm({initialEmail="",lockEmail=false,initialMode="signin",compact=false,initialProfile=emptyCustomerProfile}:{initialEmail?:string;lockEmail?:boolean;initialMode?:Mode;compact?:boolean;initialProfile?:CustomerProfile}){
  const router=useRouter();
  const [email,setEmail]=useState(initialEmail);
  const [profile]=useState<CustomerProfile>(initialProfile);
  const [mode,setMode]=useState<Mode>(initialMode);
  const [message,setMessage]=useState("");
  const [success,setSuccess]=useState(false);
  const [busy,setBusy]=useState(false);

  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!isSupabaseConfigured){setMessage("إعدادات Supabase غير مكتملة.");return;}
    setBusy(true);setMessage("");setSuccess(false);
    const form=new FormData(event.currentTarget);
    const password=String(form.get("password")||"");
    const normalizedEmail=email.trim().toLowerCase();
    const supabase=createClient();
    try{
      if(mode==="signup"){
        const callback=new URL("/auth/callback",window.location.origin);
        callback.searchParams.set("next","/account?confirmed=1");
        const {data,error}=await supabase.auth.signUp({
          email:normalizedEmail,
          password,
          options:{emailRedirectTo:callback.toString(),data:profileToMetadata(profile)},
        });
        if(error)throw error;
        if(data.session){
          const {error:claimError}=await supabase.rpc("claim_customer_orders",{});
          if(claimError)console.error("Unable to claim customer orders.",claimError);
          router.replace("/account?confirmed=1");router.refresh();return;
        }
        setSuccess(true);
        setMessage(compact?`طلبك اتسجل بالفعل. بعتنا رسالة تأكيد إلى ${normalizedEmail}. بعد التأكيد هتلاقيه في حسابك؛ ولو رجعك المتجر، سجّلي الدخول بنفس البريد من «حسابي وطلباتي».`:`بعتنا رسالة تأكيد إلى ${normalizedEmail}. بعد التأكيد هتلاقي حسابك وطلباتك هنا.`);
      }else{
        const {error:signInError}=await supabase.auth.signInWithPassword({email:normalizedEmail,password});
        if(signInError)throw signInError;
        if(compact&&(profile.fullName||profile.phone||profile.address)){
          const {error:profileError}=await supabase.auth.updateUser({data:profileToMetadata(profile)});
          if(profileError)console.error("Unable to save customer contact details.",profileError);
        }
        const {error:claimError}=await supabase.rpc("claim_customer_orders",{});
        if(claimError)console.error("Unable to claim customer orders.",claimError);
        router.replace("/account");router.refresh();
      }
    }catch(error){
      const code=(error as {code?:string})?.code;
      const errorMessage=String((error as {message?:string})?.message||"").toLowerCase();
      if(mode==="signup"&&(errorMessage.includes("email address not authorized")||errorMessage.includes("smtp")))setMessage("رسالة التفعيل مش متاحة لسه. اضبطي مزود SMTP في إعدادات Supabase Auth.");
      else if(code==="PGRST202")setMessage("ربط الطلبات بالحساب لسه محتاج يتفعّل في قاعدة البيانات.");
      else setMessage(mode==="signin"?"البريد الإلكتروني أو كلمة المرور غير صحيحة، أو لم يتم تأكيد البريد.":"تعذر إنشاء الحساب. جرّبي بريدًا إلكترونيًا آخر أو سجّلي الدخول لو عندك حساب.");
      console.error("Customer account action failed.",error);
    }finally{setBusy(false);}
  }

  return <section className={`customer-auth-card ${compact?"compact":""}`}>
    {compact&&<><span className="eyebrow">حسابك وطلباتك</span><h3>خلي طلباتك محفوظة في حسابك</h3><p>طلبك اتسجل بالفعل. إنشاء الحساب اختياري، وبيانات التوصيل هتتحفظ عشان تستخدميها بعدين.</p></>}
    <div className="customer-auth-tabs"><button type="button" className={mode==="signup"?"active":""} onClick={()=>{setMode("signup");setMessage("");setSuccess(false);}}>إنشاء حساب</button><button type="button" className={mode==="signin"?"active":""} onClick={()=>{setMode("signin");setMessage("");setSuccess(false);}}>عندي حساب</button></div>
    <form className="customer-auth-form" onSubmit={submit}>
      <label>البريد الإلكتروني<input type="email" required maxLength={254} autoComplete="email" value={email} readOnly={lockEmail} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></label>
      <label>كلمة المرور<input name="password" type="password" required minLength={8} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder={mode==="signup"?"٨ أحرف على الأقل":"كلمة المرور"}/></label>
      {mode==="signup"&&<small>هنبعتلك رسالة لتأكيد البريد. بعد التأكيد هتظهر طلباتك المرتبطة بنفس البريد.</small>}
      {message&&<div className={success?"success-note":"form-error"} role="status">{message}</div>}
      {success&&<Link className="customer-auth-resend" href={`/account/login?email=${encodeURIComponent(email.trim().toLowerCase())}`}>لو رجعك التأكيد للمتجر، ادخلي من هنا بنفس البريد</Link>}
      <button className="button button-dark" disabled={busy}>{busy?"لحظة واحدة...":mode==="signup"?"إنشاء حسابي":"دخول لحسابي"}</button>
    </form>
  </section>;
}
