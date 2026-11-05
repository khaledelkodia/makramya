"use client";

import { useState } from "react";
import { Check, LoaderCircle, Tag } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export function CouponField({subtotal,onApplied,initialCode=""}:{subtotal:number;onApplied:(code:string,discount:number)=>void;initialCode?:string}){
  const [code,setCode]=useState(initialCode),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[applied,setApplied]=useState(Boolean(initialCode));
  async function apply(){
    if(!code.trim()){setMessage("اكتبي كود الكوبون الأول.");return;}
    setBusy(true);setMessage("");
    try{
      const {data,error}=await createClient().rpc("quote_coupon",{p_code:code.trim(),p_subtotal:subtotal});
      if(error)throw error;
      const quote=Array.isArray(data)?data[0]:data;
      if(!quote?.valid){setApplied(false);onApplied("",0);setMessage(quote?.message||"الكوبون غير صالح.");return;}
      setCode(quote.normalized_code);setApplied(true);onApplied(quote.normalized_code,Number(quote.discount_amount));setMessage(quote.message||"اتطبق الكوبون.");
    }catch(error){
      const code=(error as {code?:string})?.code;
      setMessage(code==="PGRST202"?"شغّلي ترحيل العروض والكوبونات في Supabase أولاً.":"تعذر التحقق من الكوبون. حاولي مرة تانية.");
    }finally{setBusy(false);}
  }
  function clear(){setCode("");setApplied(false);setMessage("");onApplied("",0);}
  return <div className="coupon-entry"><div className="coupon-input-row"><Tag size={16}/><input value={code} onChange={event=>{setCode(event.target.value.toUpperCase());if(applied){setApplied(false);onApplied("",0);setMessage("");}}} placeholder="عندك كود خصم؟" aria-label="كود الخصم"/><button type="button" onClick={applied?clear:apply} disabled={busy}>{busy?<LoaderCircle className="spin" size={14}/>:applied?<Check size={14}/>:"تطبيق"}</button></div>{message&&<small className={applied?"coupon-success":"coupon-message"}>{message}</small>}</div>;
}
