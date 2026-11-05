"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";

type Mode = "signin" | "signup";

export function CustomerAuthForm({initialEmail="",lockEmail=false,initialMode="signin",compact=false}:{initialEmail?:string;lockEmail?:boolean;initialMode?:Mode;compact?:boolean}){
  const router=useRouter();
  const [email,setEmail]=useState(initialEmail);
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
        const {data,error}=await supabase.auth.signUp({
          email:normalizedEmail,
          password,
          options:{emailRedirectTo:`${window.location.origin}/auth/callback?next=/account`},
        });
        if(error)throw error;
        if(data.session){
          const {error:claimError}=await supabase.rpc("claim_customer_orders",{});
          if(claimError)console.error("Unable to claim customer orders.",claimError);
          router.replace("/account");router.refresh();return;
        }
        setSuccess(true);
        setMessage(`بعتنا رسالة تأكيد إلى ${normalizedEmail}. أكدي البريد عشان تلاقي طلباتك في حسابك.`);
      }else{
        const {error:signInError}=await supabase.auth.signInWithPassword({email:normalizedEmail,password});
        if(signInError)throw signInError;
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
    {compact&&<><span className="eyebrow">حسابك وطلباتك</span><h3>خلي طلباتك محفوظة في حسابك</h3><p>الحساب اختياري. استخدمي نفس البريد اللي دخلتيه في بيانات الطلب.</p></>}
    <div className="customer-auth-tabs"><button type="button" className={mode==="signup"?"active":""} onClick={()=>{setMode("signup");setMessage("");setSuccess(false);}}>إنشاء حساب</button><button type="button" className={mode==="signin"?"active":""} onClick={()=>{setMode("signin");setMessage("");setSuccess(false);}}>عندي حساب</button></div>
    <form className="customer-auth-form" onSubmit={submit}>
      <label>البريد الإلكتروني<input type="email" required maxLength={254} autoComplete="email" value={email} readOnly={lockEmail} onChange={event=>setEmail(event.target.value)} placeholder="name@example.com"/></label>
      <label>كلمة المرور<input name="password" type="password" required minLength={8} autoComplete={mode==="signup"?"new-password":"current-password"} placeholder={mode==="signup"?"٨ أحرف على الأقل":"كلمة المرور"}/></label>
      {mode==="signup"&&<small>هنبعتلك رسالة لتأكيد البريد. بعد التأكيد هتظهر طلباتك المرتبطة بنفس البريد.</small>}
      {message&&<div className={success?"success-note":"form-error"} role="status">{message}</div>}
      {success&&<Link className="customer-auth-resend" href={`/account/login?email=${encodeURIComponent(normalizedEmail)}`}>لو عندك حساب بالفعل، سجّلي الدخول</Link>}
      <button className="button button-dark" disabled={busy}>{busy?"لحظة واحدة...":mode==="signup"?"إنشاء حسابي":"دخول لحسابي"}</button>
    </form>
  </section>;
}
