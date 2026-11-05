"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowRight, Check, Minus, Plus, ShoppingBag, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import type { DeliverySettings, Product } from "@/lib/types";
import { calculateDeliveryFee, deliveryWindow, EGYPT_GOVERNORATES } from "@/lib/delivery";
import { CustomerAuthForm } from "@/components/customer-auth-form";
import { emptyCustomerProfile, profileToMetadata, type CustomerProfile } from "@/lib/customer-profile";
import { useCustomerSession } from "@/hooks/use-customer-session";
import { CouponField } from "@/components/coupon-field";

const egp=(n:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(n);
const effectivePrice=(product:Product)=>product.sale_price&&product.sale_price<product.price?product.sale_price:product.price;
const CART_STORAGE_KEY="makramya-cart-v1";

function recoveryItems(product:Product,color:string,size:string,quantity:number){
  let saved:{product:{id:string};color:{name:string};size:string;quantity:number}[]=[];
  try{const raw=localStorage.getItem(CART_STORAGE_KEY);if(raw){const parsed=JSON.parse(raw);if(Array.isArray(parsed))saved=parsed;}}catch{}
  return [...saved.map(item=>({product_id:item.product.id,color:item.color.name,size:item.size,quantity:item.quantity})),{product_id:product.id,color,size,quantity}];
}

export function ProductDetail({product,categorySlug,deliverySettings}:{product:Product;categorySlug:string;deliverySettings:DeliverySettings}){
  const [colorIndex,setColorIndex]=useState(0),[size,setSize]=useState(product.sizes[0]||""),[width,setWidth]=useState(""),[height,setHeight]=useState(""),[quantity,setQuantity]=useState(1),[formOpen,setFormOpen]=useState(false),[busy,setBusy]=useState(false),[message,setMessage]=useState(""),[trackingOrderId,setTrackingOrderId]=useState<string|null>(null),[governorate,setGovernorate]=useState(""),[checkoutEmail,setCheckoutEmail]=useState(""),[pendingEmail,setPendingEmail]=useState(""),[pendingProfile,setPendingProfile]=useState<CustomerProfile>(emptyCustomerProfile),[customerAccountsReady,setCustomerAccountsReady]=useState(true),[couponCode,setCouponCode]=useState(""),[couponDiscount,setCouponDiscount]=useState(0),[cartConsent,setCartConsent]=useState(false),[consentLoadedFor,setConsentLoadedFor]=useState(""),[recoverySaved,setRecoverySaved]=useState(false);
  const {userId:customerId,email:accountEmail,signedIn,profile,setProfile}=useCustomerSession();
  useEffect(()=>{if(profile.governorate)setGovernorate(current=>current||profile.governorate);},[profile.governorate]);
  useEffect(()=>{
    if(!signedIn||!customerId){setCartConsent(localStorage.getItem(`${CART_STORAGE_KEY}-contact:guest`)==="yes");setConsentLoadedFor("guest");return;}
    try{setCartConsent(localStorage.getItem(`${CART_STORAGE_KEY}-contact:${customerId}`)==="yes");}catch{setCartConsent(false);}
    setConsentLoadedFor(customerId);
  },[signedIn,customerId]);
  useEffect(()=>{
    if(!formOpen||consentLoadedFor!==(signedIn?customerId:"guest"))return;
    if(size.includes("مخصوص")&&(!width||!height))return;
    if(!signedIn&&!cartConsent)return;
    if(cartConsent&&(profile.fullName.trim().length<2||profile.phone.trim().length<7||profile.address.trim().length<5||!(accountEmail||checkoutEmail).trim()))return;
    const finalSize=size.includes("مخصوص")?`${width} × ${height} سم`:size;
    const timer=window.setTimeout(()=>{
      let key:string;
      if(signedIn)key=`u:${customerId}`;
      else{key=localStorage.getItem(`${CART_STORAGE_KEY}-guest-id`)||"";if(!key){key=crypto.randomUUID();localStorage.setItem(`${CART_STORAGE_KEY}-guest-id`,key);}key=`g:${key}`;}
      const email=cartConsent?(accountEmail||checkoutEmail).trim().toLowerCase():"";
      void createClient().rpc("save_customer_cart",{p_cart_key:key,p_items:recoveryItems(product,product.colors[colorIndex].name,finalSize,quantity),p_customer_name:cartConsent?profile.fullName:"",p_customer_email:email,p_phone:cartConsent?profile.phone:"",p_address:cartConsent?profile.address:"",p_governorate:cartConsent?(governorate||profile.governorate):"",p_contact_consent:cartConsent}).then(({error})=>{if(!error)setRecoverySaved(true);});
    },650);
    return()=>window.clearTimeout(timer);
  },[formOpen,consentLoadedFor,signedIn,customerId,size,width,height,cartConsent,profile,accountEmail,checkoutEmail,governorate,product,colorIndex,quantity]);
  const availableGovernorates=EGYPT_GOVERNORATES.filter(item=>deliverySettings.delivery_zones.some(zone=>zone.governorates.includes(item)));
  const subtotal=effectivePrice(product)*quantity;
  const deliveryFee=calculateDeliveryFee(deliverySettings,subtotal,governorate);
  const totalWithDelivery=deliveryFee===null?null:subtotal+deliveryFee-Math.min(couponDiscount,subtotal);
  function updateRecoveryConsent(consent:boolean){
    const wasConsented=cartConsent;setCartConsent(consent);setRecoverySaved(false);
    if(signedIn){try{localStorage.setItem(`${CART_STORAGE_KEY}-contact:${customerId}`,consent?"yes":"no");}catch{}}
    else{try{localStorage.setItem(`${CART_STORAGE_KEY}-contact:guest`,consent?"yes":"no");}catch{}if(wasConsented&&!consent){try{const key=localStorage.getItem(`${CART_STORAGE_KEY}-guest-id`);if(key)void createClient().rpc("revoke_customer_cart_contact",{p_cart_key:`g:${key}`});}catch{}}}
  }
  async function submit(event:React.FormEvent<HTMLFormElement>){
    event.preventDefault();
    if(!isSupabaseConfigured){setMessage("الطلب أونلاين هيتفعل بعد ربط المشروع بـ Supabase.");return;}
    if(!governorate){setMessage("اختاري محافظة التوصيل عشان نحدد الرسوم.");return;}
    if(size.includes("مخصوص")&&(!width||!height)){setMessage("اكتبي العرض والطول عشان نعملها على مقاسك.");return;}
    setBusy(true);setMessage("");
    const form=new FormData(event.currentTarget);const finalSize=size.includes("مخصوص")?`${width} × ${height} سم`:size;
    const submittedProfile:CustomerProfile={fullName:String(form.get("customer")||"").trim(),phone:String(form.get("phone")||"").trim(),address:String(form.get("address")||"").trim(),governorate};
    const submittedEmail=(accountEmail||String(form.get("customer_email")||"")).trim().toLowerCase();
    const orderArgs={p_customer_name:submittedProfile.fullName,p_phone:submittedProfile.phone,p_address:submittedProfile.address,p_governorate:governorate,p_customer_email:submittedEmail,p_coupon_code:couponCode,p_notes:String(form.get("notes")||""),p_items:[{product_id:product.id,color:product.colors[colorIndex].name,size:finalSize,quantity}]};
    try{
      const supabase=createClient();let {data:orderId,error}=await supabase.rpc("place_order",orderArgs);let accountsReady=true;
      if(error?.code==="PGRST202"){
        if(couponCode)throw Object.assign(new Error("migration required"),{code:"coupon_migration_required"});
        const customerLegacy=await supabase.rpc("place_order",{p_customer_name:orderArgs.p_customer_name,p_phone:orderArgs.p_phone,p_address:orderArgs.p_address,p_governorate:orderArgs.p_governorate,p_customer_email:submittedEmail,p_notes:orderArgs.p_notes,p_items:orderArgs.p_items});
        orderId=customerLegacy.data;error=customerLegacy.error;
        if(error?.code==="PGRST202"){
          accountsReady=false;
          const legacy=await supabase.rpc("place_order",{p_customer_name:orderArgs.p_customer_name,p_phone:orderArgs.p_phone,p_address:orderArgs.p_address,p_governorate:orderArgs.p_governorate,p_notes:orderArgs.p_notes,p_items:orderArgs.p_items});
          orderId=legacy.data;error=legacy.error;
        }
      }
      if(error)throw error;if(!orderId)throw new Error("order id missing");
      setProfile(submittedProfile);
      if(signedIn)void supabase.auth.updateUser({data:profileToMetadata(submittedProfile)}).then(({error:profileError})=>{if(profileError)console.error("Unable to save customer contact details.",profileError);});
      setPendingEmail(accountsReady?submittedEmail:"");setPendingProfile(submittedProfile);setCustomerAccountsReady(accountsReady);setTrackingOrderId(orderId);setMessage("طلبك اتسجل بالفعل قبل إنشاء الحساب. تابعي حالته من الرابط.");setFormOpen(false);
    }catch(error){const code=(error as {code?:string})?.code;setMessage(code==="coupon_migration_required"?"شغّلي ترحيل العروض والكوبونات في Supabase قبل استخدام الكود.":code==="PGRST202"?"تعذر تسجيل الطلب؛ تأكدي من تحديث قاعدة البيانات أولاً.":"ما قدرناش نسجل الطلب. جرّبي تاني أو كلمينا.");console.error(error);}
    finally{setBusy(false);}
  }
  return <>
    <div className="announcement">تفاصيل يدوية معمولة بحب، مخصوص ليكي <span>✳</span> اختاري محافظتك لمعرفة رسوم التوصيل</div>
    <header className="site-header"><Link className="brand" href="/"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link><nav className="main-nav"><Link href="/">الرئيسية</Link><Link href="/categories" className="active">تسوقي المنتجات</Link><Link href={signedIn?"/account":"/account/login"}>{signedIn?`حسابي${profile.fullName?` · ${profile.fullName}`:""}`:"دخول / طلباتي"}</Link><Link href="/#story">حكايتنا</Link></nav><div className="header-actions"><Link className="admin-entry" href="/dashboard">إدارة المتجر <span>↗</span></Link></div></header>
    <main className="pdp-main"><div className="pdp-breadcrumb"><Link href="/">الرئيسية</Link><span>←</span><Link href="/categories">الأصناف</Link><span>←</span><Link href={`/category/${categorySlug}`}>{product.category}</Link><span>←</span><b>{product.name}</b></div><div className="pdp-layout"><div className="pdp-gallery"><div className="pdp-image">{product.image_url?<Image src={product.image_url} alt={product.name} fill priority sizes="(max-width: 760px) 100vw, 55vw"/>:<div className={`product-art ${product.style_key}`}><div className="art-piece"/></div>}{product.badge&&<span className="badge">{product.badge}</span>}</div><div className="pdp-image-caption"><span>صناعة يدوية · خامات طبيعية</span><span>مكرمية / القاهرة</span></div></div>
      <section className="pdp-info"><span className="eyebrow">{product.category} · شغل إيدوي</span><h1>{product.name}</h1><div className="pdp-price">{product.sale_price&&product.sale_price<product.price?<><del>{egp(product.price)}</del>{egp(product.sale_price)}</>:egp(product.price)} <small>السعر المبدئي للقطعة</small></div><p className="pdp-description">{product.description}</p><div className="pdp-divider"/><label className="option-label">اختاري اللون</label><div className="swatches">{product.colors.map((color,index)=><button type="button" key={color.name} className={`swatch ${index===colorIndex?"selected":""}`} title={color.name} aria-label={color.name} style={{background:color.hex}} onClick={()=>setColorIndex(index)}/>)}</div><small className="color-name">{product.colors[colorIndex]?.name}</small><label className="option-label" htmlFor="pdp-size">المقاس المناسب ليكي</label><select id="pdp-size" className="admin-select" value={size} onChange={event=>setSize(event.target.value)}>{product.sizes.map(option=><option key={option}>{option}</option>)}</select>{size.includes("مخصوص")&&<div className="size-fields"><input type="number" min="1" max="9999" value={width} onChange={event=>setWidth(event.target.value)} placeholder="العرض بالسنتيمتر"/><input type="number" min="1" max="9999" value={height} onChange={event=>setHeight(event.target.value)} placeholder="الطول بالسنتيمتر"/></div>}<div className="pdp-quantity"><span>الكمية</span><div className="quantity-control"><button type="button" onClick={()=>setQuantity(Math.max(1,quantity-1))}><Minus size={13}/></button><span>{quantity}</span><button type="button" onClick={()=>setQuantity(quantity+1)}><Plus size={13}/></button></div></div><button className="add-cart pdp-order-button" onClick={()=>{setMessage("");setFormOpen(true)}}><ShoppingBag size={16}/> اطلبي القطعة · {egp(effectivePrice(product)*quantity)}</button><p className="pdp-shipping">{deliverySettings.customer_note} · مدة التوصيل {deliveryWindow(deliverySettings)}</p>
        {message&&<div className={`pdp-message ${message.startsWith("وصلنا")||message.startsWith("طلبك اتسجل")?"success-note":"form-error"}`} role="status">{message}</div>}
        {trackingOrderId&&<><Link className="pdp-tracking-link" href={`/track/${trackingOrderId}`}>تابعي حالة الطلب <ArrowRight size={14}/></Link>{signedIn?<Link className="pdp-tracking-link" href="/account">افتحي حسابك وطلباتك <ArrowRight size={14}/></Link>:customerAccountsReady?<CustomerAuthForm initialEmail={pendingEmail} lockEmail initialMode="signup" initialProfile={pendingProfile} compact/>:<p className="customer-account-pending">الطلب اتسجل. إنشاء الحساب هيتاح بعد تفعيل قاعدة البيانات؛ احتفظي برابط متابعة الطلب.</p>}</>}
        {formOpen&&<form className="order-form pdp-checkout" onSubmit={submit}>
          <div className="pdp-form-title"><b>بيانات التوصيل</b><button type="button" onClick={()=>setFormOpen(false)} aria-label="إغلاق"><X size={15}/></button></div>
          <p>{product.name} · {product.colors[colorIndex].name} · {size.includes("مخصوص")?`${width||"—"} × ${height||"—"} سم`:size} · {quantity} قطعة</p>
          <label className="delivery-governorate-select">محافظة التوصيل<select name="governorate" value={governorate} required onChange={event=>setGovernorate(event.target.value)}><option value="">اختاري المحافظة</option>{availableGovernorates.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
          <CouponField subtotal={subtotal} initialCode={couponCode} onApplied={(code,discount)=>{setCouponCode(code);setCouponDiscount(discount);}}/>
          <div className="delivery-cost-summary checkout-delivery-summary"><div><span>قيمة المنتجات</span><b>{egp(subtotal)}</b></div>{couponDiscount>0&&<div className="coupon-discount-row"><span>خصم الكوبون {couponCode}</span><b>− {egp(Math.min(couponDiscount,subtotal))}</b></div>}<div><span>رسوم التوصيل</span><b>{deliveryFee===null?"اختاري المحافظة":deliveryFee===0?"مجاني":egp(deliveryFee)}</b></div><div className="delivery-total"><span>الإجمالي المتوقع</span><b>{totalWithDelivery===null?"اختاري المحافظة":egp(totalWithDelivery)}</b></div><small>{governorate?`التوصيل إلى ${governorate}`:"اختاري المحافظة لمعرفة الرسوم"} · {deliveryWindow(deliverySettings)}</small></div>
          <input name="customer" required minLength={2} maxLength={120} autoComplete="name" value={profile.fullName} onChange={event=>setProfile(current=>({...current,fullName:event.target.value}))} placeholder="اسمك بالكامل"/>
          <input name="phone" type="tel" required minLength={7} maxLength={30} autoComplete="tel" value={profile.phone} onChange={event=>setProfile(current=>({...current,phone:event.target.value}))} placeholder="رقم الموبايل"/>
          <input name="customer_email" type="email" required maxLength={254} autoComplete="email" value={accountEmail||checkoutEmail} readOnly={Boolean(accountEmail)} onChange={event=>setCheckoutEmail(event.target.value)} placeholder="البريد الإلكتروني لاسترجاع طلباتك"/>
          <small className="checkout-email-note">{signedIn?"بياناتك محفوظة. غيري العنوان أو الرقم لو هتطلبي توصيل لمكان أو رقم جديد.":"بعد إنشاء الحساب هتتحفظ بياناتك عشان متكتبيهاش تاني."}</small>
          <label className="consent-field checkout-consent"><input type="checkbox" checked={cartConsent} onChange={event=>updateRecoveryConsent(event.target.checked)}/><span>أوافق على حفظ بيانات التواصل عشان المتجر يقدر يتواصل معي لو ما كملتش الطلب أو بخصوص العروض</span></label>
          {recoverySaved&&<small className="recovery-saved-note">اتحفظت السلة على حسابك. تقدري تكملي الطلب بعدين.</small>}
          <input name="address" required minLength={5} maxLength={500} autoComplete="street-address" value={profile.address} onChange={event=>setProfile(current=>({...current,address:event.target.value}))} placeholder="عنوان التوصيل بالتفصيل"/>
          <textarea name="notes" maxLength={1000} placeholder="ملاحظات إضافية (اختياري)"/><button className="button button-dark" disabled={busy}>{busy?"جاري تسجيل الطلب...":"أكدي الطلب"}<ArrowRight size={15}/></button>
        </form>}
      </section></div><section className="pdp-story"><span className="eyebrow">قطعة معمولة مخصوص</span><h2>كل عقدة <em>ليها حكاية.</em></h2><p>اختاري اللون والمقاس اللي يناسب بيتك. بنبدأ التنفيذ بعد ما نأكد معاكي تفاصيل الطلب، وبنهتم بكل عقدة لحد ما القطعة تبقى جاهزة لبيتك.</p><Link href={`/category/${categorySlug}`} className="text-link">اكتشفي باقي {product.category} <span>←</span></Link></section></main>
    <footer className="footer"><Link className="brand footer-brand" href="/"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link><p>تفاصيل بتتعمل بحب، لبيوت بتتحب.</p><div><Link href="/categories">تسوقي الأصناف</Link><Link href="/account/login">حسابي وطلباتي</Link><Link href="/#story">حكايتنا</Link><Link href="/#custom">طلب مخصوص</Link></div><small>© {new Date().getFullYear()} مكرمية. كل قطعة بتحكي حكاية.</small></footer>
  </>;
}
