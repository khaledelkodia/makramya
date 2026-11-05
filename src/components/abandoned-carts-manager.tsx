"use client";

import { useState } from "react";
import { Check, Clock3, MessageCircle, ShoppingBag, X } from "lucide-react";
import { closeCustomerCart } from "@/app/actions";
import type { CustomerCart } from "@/lib/types";

const egp=(value:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(value);
function contactTime(value:string){const minutes=Math.floor((Date.now()-new Date(value).getTime())/60000);if(minutes<1)return "من لحظات";if(minutes<60)return `من ${minutes} دقيقة`;const hours=Math.floor(minutes/60);if(hours<24)return `من ${hours} ساعة`;return `من ${Math.floor(hours/24)} يوم`;}
function whatsapp(phone:string){let number=phone.replace(/\D/g,"");if(number.startsWith("0"))number=`20${number.slice(1)}`;else if(!number.startsWith("20"))number=`20${number}`;return `https://wa.me/${number}`;}

export function AbandonedCartsManager({carts}:{carts:CustomerCart[]}){
  const [busy,setBusy]=useState(""),[toast,setToast]=useState("");
  async function close(cart:CustomerCart){setBusy(cart.cart_key);const result=await closeCustomerCart(cart.cart_key);setBusy("");setToast(result.ok?"اتقفلت السلة.":result.error||"تعذر تحديث السلة.");window.setTimeout(()=>setToast(""),2800);}
  const open=carts.filter(cart=>cart.status==="active"), closed=carts.filter(cart=>cart.status==="closed");
  return <>
    <div className="panel-title"><div><h3>السلات اللي ما كملتش الطلب</h3><small>الحسابات المسجلة بتتسجل تلقائيًا، وبيانات التواصل بتظهر بعد الموافقة فقط.</small></div><span className="status status-new">{open.length} سلة مفتوحة</span></div>
    {open.length?open.map(cart=>{
      const old=Date.now()-new Date(cart.updated_at).getTime()>30*60*1000;
      return <article className="admin-card recovery-cart" key={cart.cart_key}>
        <div className="recovery-cart-heading"><div><b>{cart.contact_consent&&cart.customer_name?cart.customer_name:cart.customer_id?"عميلة مسجلة":"زائرة"}</b><span className={`status ${old?"status-new":""}`}>{old?"سلة متروكة":"لسه بتتسوق"}</span></div><small><Clock3 size={13}/>{contactTime(cart.updated_at)}</small></div>
        {cart.contact_consent?<div className="recovery-contact"><span>{cart.phone}</span><span>{cart.customer_email}</span><span>{cart.governorate}{cart.address?` · ${cart.address}`:""}</span></div>:<p className="recovery-private">{cart.customer_id?"حساب مسجل، لكن لم توافق العميلة على التواصل بخصوص السلة أو العروض.":"بيانات التواصل غير متاحة؛ الزائرة لم تحفظ السلة ببياناتها."}</p>}
        <div className="recovery-items">{cart.items.map((item,index)=><div key={`${item.product_id}-${index}`}><span>{item.product_name} · {item.color} · {item.size} × {item.quantity}</span><b>{egp(item.line_total)}</b></div>)}</div>
        <div className="recovery-cart-footer"><b>قيمة السلة: {egp(cart.subtotal)}</b><div>{cart.contact_consent&&cart.phone&&<a className="button button-dark" href={whatsapp(cart.phone)} target="_blank" rel="noreferrer"><MessageCircle size={14}/>تواصلي عبر واتساب</a>}<button className="recovery-close" onClick={()=>void close(cart)} disabled={busy===cart.cart_key}>{busy===cart.cart_key?"...":<><Check size={14}/>إغلاق السلة</>}</button></div></div>
      </article>;
    }):<div className="empty-state"><ShoppingBag size={25}/><span>مفيش سلات مفتوحة.</span></div>}
    {!!closed.length&&<details className="closed-carts"><summary>السلات المغلقة ({closed.length})</summary>{closed.map(cart=><div key={cart.cart_key}><span>{cart.contact_consent?cart.customer_name||cart.customer_email:"عميلة بدون موافقة تواصل"}</span><small>{new Date(cart.updated_at).toLocaleDateString("ar-EG")}</small><X size={13}/></div>)}</details>}
    <div className={`toast ${toast?"show":""}`} role="status">{toast}</div>
  </>;
}
