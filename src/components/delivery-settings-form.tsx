"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, LoaderCircle, Plus, Trash2, Truck } from "lucide-react";
import { saveDeliverySettings } from "@/app/actions";
import { calculateDeliveryFee, deliveryWindow, EGYPT_GOVERNORATES } from "@/lib/delivery";
import type { DeliverySettings, DeliveryZone } from "@/lib/types";

const egp=(value:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(value);

export function DeliverySettingsForm({settings,setupMessage}:{settings:DeliverySettings;setupMessage?:string}){
  const router=useRouter();
  const [message,setMessage]=useState("");
  const [messageIsError,setMessageIsError]=useState(false);
  const [busy,startTransition]=useTransition();
  const [zones,setZones]=useState<DeliveryZone[]>(settings.delivery_zones);

  function toggleGovernorate(zoneIndex:number,governorate:string){
    setZones(current=>current.map((zone,index)=>index!==zoneIndex?zone:{...zone,governorates:zone.governorates.includes(governorate)?zone.governorates.filter(item=>item!==governorate):[...zone.governorates,governorate]}));
  }

  function addUnassignedToZone(zoneIndex:number){
    const available=EGYPT_GOVERNORATES.filter(governorate=>!zones.some((zone,index)=>index!==zoneIndex&&zone.governorates.includes(governorate)));
    setZones(current=>current.map((zone,index)=>index===zoneIndex?{...zone,governorates:Array.from(new Set([...zone.governorates,...available]))}:zone));
  }

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

  const sampleGovernorate=zones[0]?.governorates[0];
  const sampleFee=sampleGovernorate?calculateDeliveryFee({...settings,delivery_zones:zones},1000,sampleGovernorate):null;
  const unassignedGovernorates=EGYPT_GOVERNORATES.filter(governorate=>!zones.some(zone=>zone.governorates.includes(governorate)));
  return <section className="dashboard-content delivery-settings-page">
    <div className="products-toolbar"><div><h2>التوصيل</h2><p>حددي رسوم الشحن والمدة والمناطق اللي بتوصليلها.</p></div><span className="delivery-page-icon"><Truck size={20}/></span></div>
    {setupMessage&&<div className="notice-box" role="status">{setupMessage}</div>}
    {message&&<div className={messageIsError?"form-error":"success-note"} role={messageIsError?"alert":"status"}>{message}</div>}
    <form className="product-form admin-card delivery-settings-form" onSubmit={submit}>
      <div className="form-heading"><span className="eyebrow">إعدادات المتجر</span><h3>تفاصيل التوصيل</h3></div>
      <input type="hidden" name="delivery_zones" value={JSON.stringify(zones)}/>
      <div className="delivery-zones-heading"><div><b>أسعار التوصيل حسب المحافظة</b><small>اجمعي المحافظات ذات السعر نفسه، أو أنشئي مجموعة مستقلة لكل محافظة.</small></div><button type="button" className="button delivery-add-zone" onClick={()=>setZones(current=>[...current,{governorates:[],fee:settings.base_fee}])}><Plus size={14}/>مجموعة سعر جديدة</button></div>
      <div className="delivery-zones-list">
        {zones.map((zone,zoneIndex)=><section className="delivery-zone-card" key={zoneIndex}>
          <div className="delivery-zone-heading"><b>مجموعة {new Intl.NumberFormat("ar-EG").format(zoneIndex+1)}</b><button type="button" className="delivery-remove-zone" aria-label={`حذف المجموعة ${zoneIndex+1}`} onClick={()=>setZones(current=>current.filter((_,index)=>index!==zoneIndex))}><Trash2 size={14}/></button></div>
          <div className="delivery-zone-fields">
            <details className="governorate-picker"><summary>{zone.governorates.length?`${new Intl.NumberFormat("ar-EG").format(zone.governorates.length)} محافظة مختارة`:"اختاري محافظة أو أكثر"}</summary><div className="governorate-options"><button type="button" onClick={()=>addUnassignedToZone(zoneIndex)}>اختاري كل المحافظات المتاحة</button>{EGYPT_GOVERNORATES.map(governorate=>{const selected=zone.governorates.includes(governorate);const assignedElsewhere=zones.some((other,index)=>index!==zoneIndex&&other.governorates.includes(governorate));return <label key={governorate} className={assignedElsewhere?"governorate-option assigned":"governorate-option"}><input type="checkbox" checked={selected} disabled={busy||assignedElsewhere} onChange={()=>toggleGovernorate(zoneIndex,governorate)}/><span>{governorate}</span></label>})}</div></details>
            <label className="delivery-zone-fee">سعر التوصيل بالجنيه<input type="number" min="0" max="100000" step="1" value={zone.fee} disabled={busy} onChange={event=>setZones(current=>current.map((item,index)=>index===zoneIndex?{...item,fee:Number(event.target.value)||0}:item))}/></label>
          </div>
          {zone.governorates.length>0&&<small className="delivery-zone-selected">{zone.governorates.join("، ")}</small>}
        </section>)}
      </div>
      {unassignedGovernorates.length>0&&<p className="delivery-unassigned-note">المحافظات غير المحددة لن تظهر للعميلة في نموذج الطلب: {unassignedGovernorates.join("، ")}</p>}
      <div className="form-grid">
        <label>شحن مجاني عند قيمة طلب<input name="free_shipping_threshold" type="number" min="1" max="10000000" step="1" defaultValue={settings.free_shipping_threshold??""} placeholder="اتركيه فارغاً لإلغاء العرض"/><small>مثال: الطلبات من هذا المبلغ أو أكثر يكون شحنها مجانياً.</small></label>
        <label>أقل مدة للتوصيل (أيام)<input name="min_delivery_days" type="number" min="1" max="90" step="1" defaultValue={settings.min_delivery_days} required/></label>
        <label>أقصى مدة للتوصيل (أيام)<input name="max_delivery_days" type="number" min="1" max="90" step="1" defaultValue={settings.max_delivery_days} required/></label>
        <label className="full-field">ملاحظة للعميلة<textarea name="customer_note" maxLength={1000} rows={3} defaultValue={settings.customer_note}/><small>تظهر في السلة وصفحة المنتج قبل إرسال الطلب.</small></label>
        <label className="checkbox-field full-field delivery-reference-option"><input type="checkbox" name="allow_reference_image" defaultChecked={settings.allow_reference_image}/><span><b>السماح برفع صورة مرجعية للطلب</b><small>عند التفعيل، تظهر للعميلة خانة اختيار صورة في صفحة إتمام الطلب. الصور خاصة ولا يراها إلا فريق الطلبات.</small></span></label>
      </div>
      <button className="button button-dark submit-product" disabled={busy||Boolean(setupMessage)}>{busy?<LoaderCircle className="spin" size={15}/>:<Check size={15}/>}حفظ إعدادات التوصيل</button>
    </form>
    <aside className="admin-card delivery-preview"><div className="delivery-preview-icon"><Truck size={18}/></div><div><span className="eyebrow">معاينة الإعدادات الحالية</span><p>{sampleGovernorate?`سعر ${sampleGovernorate} على طلب بقيمة ١٬٠٠٠ جنيه:`:"أضيفي محافظة لمعاينة السعر:"} <b>{sampleFee===null?"غير محدد":sampleFee===0?"مجاني":egp(sampleFee)}</b></p><p>المدة المتوقعة: <b>{deliveryWindow(settings)}</b></p><p>المحافظات المشمولة: <b>{new Intl.NumberFormat("ar-EG").format(EGYPT_GOVERNORATES.length-unassignedGovernorates.length)} من {EGYPT_GOVERNORATES.length}</b></p></div></aside>
  </section>;
}
