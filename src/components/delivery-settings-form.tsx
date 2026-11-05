"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Truck } from "lucide-react";
import { saveDeliverySettings } from "@/app/actions";
import { calculateDeliveryFee, deliveryWindow } from "@/lib/delivery";
import type { DeliverySettings } from "@/lib/types";

const egp=(value:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(value);

export function DeliverySettingsForm({settings,setupMessage}:{settings:DeliverySettings;setupMessage?:string}){
  const router=useRouter();
  const [message,setMessage]=useState("");
  const [messageIsError,setMessageIsError]=useState(false);
  const [busy,startTransition]=useTransition();

  function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    setMessage("");
    const formData=new FormData(event.currentTarget);
    startTransition(async()=>{
      const result=await saveDeliverySettings(formData);
      if(result.ok){setMessage("اتحفظت إعدادات التوصيل، وهتظهر في الطلبات الجديدة.");setMessageIsError(false);router.refresh();}
      else{setMessage(result.error||"تعذر حفظ إعدادات التوصيل.");setMessageIsError(true);}
    });
  }

  const sampleFee=calculateDeliveryFee(settings,1000);
  return <section className="dashboard-content delivery-settings-page">
    <div className="products-toolbar"><div><h2>التوصيل</h2><p>حددي رسوم الشحن والمدة والمناطق اللي بتوصليلها.</p></div><span className="delivery-page-icon"><Truck size={20}/></span></div>
    {setupMessage&&<div className="notice-box" role="status">{setupMessage}</div>}
    {message&&<div className={messageIsError?"form-error":"success-note"} role={messageIsError?"alert":"status"}>{message}</div>}
    <form className="product-form admin-card delivery-settings-form" onSubmit={submit}>
      <div className="form-heading"><span className="eyebrow">إعدادات المتجر</span><h3>تفاصيل التوصيل</h3></div>
      <div className="form-grid">
        <label>رسوم التوصيل بالجنيه<input name="base_fee" type="number" min="0" max="100000" step="1" defaultValue={settings.base_fee} required/><small>رسوم ثابتة لكل طلب، وتظهر قبل تأكيده.</small></label>
        <label>شحن مجاني عند قيمة طلب<input name="free_shipping_threshold" type="number" min="1" max="10000000" step="1" defaultValue={settings.free_shipping_threshold??""} placeholder="اتركيه فارغاً لإلغاء العرض"/><small>مثال: الطلبات من هذا المبلغ أو أكثر يكون شحنها مجانياً.</small></label>
        <label>أقل مدة للتوصيل (أيام)<input name="min_delivery_days" type="number" min="1" max="90" step="1" defaultValue={settings.min_delivery_days} required/></label>
        <label>أقصى مدة للتوصيل (أيام)<input name="max_delivery_days" type="number" min="1" max="90" step="1" defaultValue={settings.max_delivery_days} required/></label>
        <label className="full-field">المحافظات أو المناطق المتاحة<input name="coverage_area" minLength={2} maxLength={500} defaultValue={settings.coverage_area} required/><small>اكتبي المحافظات أو المناطق التي توصلين إليها.</small></label>
        <label className="full-field">ملاحظة للعميلة<textarea name="customer_note" maxLength={1000} rows={3} defaultValue={settings.customer_note}/><small>تظهر في السلة وصفحة المنتج قبل إرسال الطلب.</small></label>
      </div>
      <button className="button button-dark submit-product" disabled={busy||Boolean(setupMessage)}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>}حفظ إعدادات التوصيل</button>
    </form>
    <aside className="admin-card delivery-preview"><div className="delivery-preview-icon"><Truck size={18}/></div><div><span className="eyebrow">معاينة الإعدادات الحالية</span><p>الرسوم على طلب بقيمة ١٬٠٠٠ جنيه: <b>{sampleFee===0?"مجاني":egp(sampleFee)}</b></p><p>المدة المتوقعة: <b>{deliveryWindow(settings)}</b></p><p>النطاق: <b>{settings.coverage_area}</b></p></div></aside>
  </section>;
}
