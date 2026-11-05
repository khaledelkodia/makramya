"use client";

import { useState } from "react";
import { Check, LoaderCircle, Pause, Play, Trash2 } from "lucide-react";
import { createCoupon, deleteCoupon, setCouponActive } from "@/app/actions";
import type { StoreCoupon } from "@/lib/types";

const egp=(value:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(value);
const date=(value:string|null)=>value?new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium"}).format(new Date(value)):"بدون موعد";

export function CouponManager({coupons}:{coupons:StoreCoupon[]}){
  const [busy,setBusy]=useState(false),[toast,setToast]=useState("");
  function notify(message:string){setToast(message);window.setTimeout(()=>setToast(""),3000);}
  async function submit(event:React.FormEvent<HTMLFormElement>){event.preventDefault();const form=event.currentTarget;setBusy(true);const result=await createCoupon(new FormData(form));setBusy(false);if(result.ok){form.reset();notify("اتضاف الكوبون للمتجر.");}else notify(result.error||"تعذر حفظ الكوبون.");}
  async function toggle(coupon:StoreCoupon){setBusy(true);const result=await setCouponActive(coupon.id,!coupon.is_active);setBusy(false);notify(result.ok?(coupon.is_active?"اتوقف الكوبون.":"اتفعّل الكوبون."):result.error||"تعذر التحديث.");}
  async function remove(coupon:StoreCoupon){if(!window.confirm(`حذف الكوبون ${coupon.code}؟`))return;setBusy(true);const result=await deleteCoupon(coupon.id);setBusy(false);notify(result.ok?"اتحذف الكوبون.":result.error||"تعذر الحذف.");}
  return <>
    <div className="panel-title"><div><h3>العروض والكوبونات</h3><small>خصم على المنتجات أو أكواد خصم عند إتمام الطلب</small></div></div>
    <form className="admin-card coupon-form" onSubmit={submit}>
      <h3>إنشاء كوبون جديد</h3>
      <div className="form-grid">
        <label>كود الكوبون<input name="code" required minLength={3} maxLength={32} pattern="[A-Za-z0-9_-]+" placeholder="WELCOME10"/></label>
        <label>نوع الخصم<select name="discount_type"><option value="percent">نسبة مئوية</option><option value="fixed">مبلغ بالجنيه</option></select></label>
        <label>قيمة الخصم<input name="discount_value" type="number" min="1" step="0.01" required placeholder="10"/></label>
        <label>أقصى خصم (اختياري)<input name="max_discount" type="number" min="1" step="1" placeholder="مثال: 500"/></label>
        <label>أقل قيمة للطلب<input name="minimum_subtotal" type="number" min="0" step="1" defaultValue="0" required/></label>
        <label>عدد مرات الاستخدام<input name="usage_limit" type="number" min="1" step="1" placeholder="اتركيه فاضي من غير حد"/></label>
        <label>يبدأ في (اختياري)<input name="starts_at" type="datetime-local"/></label>
        <label>ينتهي في (اختياري)<input name="ends_at" type="datetime-local"/></label>
      </div>
      <button className="button button-dark" disabled={busy}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>}احفظي الكوبون</button>
    </form>
    <div className="coupon-list">{coupons.length?coupons.map(coupon=><article className="admin-card coupon-card" key={coupon.id}>
      <div className="coupon-code"><b>{coupon.code}</b><span className={`status ${coupon.is_active?"status-completed":"status-cancelled"}`}>{coupon.is_active?"فعال":"متوقف"}</span></div>
      <p>{coupon.discount_type==="percent"?`${coupon.discount_value}% خصم`:`خصم ${egp(coupon.discount_value)}`} {coupon.max_discount?`· بحد أقصى ${egp(coupon.max_discount)}`:""}</p>
      <small>أقل طلب {egp(coupon.minimum_subtotal)} · استُخدم {coupon.uses_count}{coupon.usage_limit?` من ${coupon.usage_limit}`:" مرة"}</small>
      <small>من {date(coupon.starts_at)} إلى {date(coupon.ends_at)}</small>
      <div className="coupon-actions"><button onClick={()=>void toggle(coupon)} disabled={busy}>{coupon.is_active?<Pause size={14}/>:<Play size={14}/>} {coupon.is_active?"إيقاف":"تفعيل"}</button><button className="delete-action" onClick={()=>void remove(coupon)} disabled={busy}><Trash2 size={14}/>حذف</button></div>
    </article>):<div className="empty-state"><span>٪</span>مفيش كوبونات لسه. أنشئي أول كود خصم.</div>}</div>
    <div className={`toast ${toast?"show":""}`} role="status">{toast}</div>
  </>;
}
