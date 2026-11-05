"use client";

import { useEffect, useMemo, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, Menu, Minus, Plus, Search, ShoppingBag, X } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { categories as staticCategories, type StoreCategory } from "@/lib/categories";
import type { CartItem, DeliverySettings, Product } from "@/lib/types";
import { categoryFallbackImages } from "@/lib/store-images";
import { calculateDeliveryFee, deliveryWindow, EGYPT_GOVERNORATES } from "@/lib/delivery";
import { CustomerAuthForm } from "@/components/customer-auth-form";
import { emptyCustomerProfile, profileToMetadata, type CustomerProfile } from "@/lib/customer-profile";
import { useCustomerSession } from "@/hooks/use-customer-session";
import { CouponField } from "@/components/coupon-field";

const egp = (value: number) => new Intl.NumberFormat("ar-EG", { style:"currency", currency:"EGP", maximumFractionDigits:0 }).format(value);
const LOCAL_CART_KEY="makramya-cart-v1";
const effectivePrice=(product:Product)=>product.sale_price&&product.sale_price<product.price?product.sale_price:product.price;
function ProductArt({ product, detail = false }: { product: Product; detail?: boolean }) {
  return product.image_url ? <Image src={product.image_url} alt={product.name} fill sizes={detail ? "100vw" : "(max-width: 640px) 50vw, 25vw"} className="product-real-image" /> : <div className={`product-art ${product.style_key} ${detail ? "detail-piece" : ""}`} aria-label={product.name}><div className="art-piece" /></div>;
}

export function Storefront({ products, initialCategory, categoryDescription, categoryIndex = false, categories:categoryItems=staticCategories.map(category=>({...category,image_url:null})), initialCategoryImage, deliverySettings }: { products: Product[]; initialCategory?: string; categoryDescription?: string; categoryIndex?: boolean; categories?:StoreCategory[]; initialCategoryImage?:string|null; deliverySettings:DeliverySettings }) {
  const category = initialCategory || "الكل";
  const [search, setSearch] = useState(""), [cart, setCart] = useState<CartItem[]>([]);
  const [active, setActive] = useState<Product | null>(null), [colorIndex, setColorIndex] = useState(0), [size, setSize] = useState(""), [quantity, setQuantity] = useState(1);
  const [cartOpen, setCartOpen] = useState(false), [checkoutOpen, setCheckoutOpen] = useState(false), [toast, setToast] = useState(""), [busy, setBusy] = useState(false), [menuOpen, setMenuOpen] = useState(false), [trackingOrderId,setTrackingOrderId]=useState<string|null>(null), [governorate,setGovernorate]=useState(""), [checkoutEmail,setCheckoutEmail]=useState(""), [pendingEmail,setPendingEmail]=useState(""), [pendingProfile,setPendingProfile]=useState<CustomerProfile>(emptyCustomerProfile), [customerAccountsReady,setCustomerAccountsReady]=useState(true), [cartReady,setCartReady]=useState(false), [cartConsent,setCartConsent]=useState(false), [consentOwner,setConsentOwner]=useState(""), [cartSaved,setCartSaved]=useState(false), [couponCode,setCouponCode]=useState(""), [couponDiscount,setCouponDiscount]=useState(0);
  const {userId:customerId,email:accountEmail,signedIn,profile,setProfile}=useCustomerSession();
  useEffect(()=>{
    try{
      const saved=localStorage.getItem(LOCAL_CART_KEY);
      if(saved){const parsed=JSON.parse(saved) as {product:Product;color:{name:string;hex:string};size:string;quantity:number}[];if(Array.isArray(parsed))setCart(parsed.map(item=>({...item,product:products.find(product=>product.id===item.product.id)||item.product})).filter(item=>item.product));}
    }catch{localStorage.removeItem(LOCAL_CART_KEY);}
    setCartReady(true);
  },[]);
  useEffect(()=>{
    if(!signedIn||!customerId){setCartConsent(localStorage.getItem(`${LOCAL_CART_KEY}-contact:guest`)==="yes");setConsentOwner("guest");return;}
    const consentKey=`${LOCAL_CART_KEY}-contact:${customerId}`;
    setCartConsent(localStorage.getItem(consentKey)==="yes");setConsentOwner(customerId);
  },[signedIn,customerId]);
  useEffect(()=>{
    if(!cartReady)return;
    try{if(cart.length)localStorage.setItem(LOCAL_CART_KEY,JSON.stringify(cart));else localStorage.removeItem(LOCAL_CART_KEY);}catch{}
    if(!cart.length)return;
    const canSaveForAccount=signedIn&&Boolean(customerId)&&consentOwner===customerId;
    const recoveryEmail=(accountEmail||checkoutEmail).trim();
    const canSaveGuest=!signedIn&&consentOwner==="guest"&&cartConsent&&profile.fullName.trim().length>=2&&profile.phone.trim().length>=7&&profile.address.trim().length>=5&&recoveryEmail.length>=5;
    if(!canSaveForAccount&&!canSaveGuest)return;
    const timer=window.setTimeout(()=>{
      const supabase=createClient();
      const key=canSaveForAccount?`u:${customerId}`:guestCartKey();
      void supabase.rpc("save_customer_cart",{p_cart_key:key,p_items:cart.map(item=>({product_id:item.product.id,color:item.color.name,size:item.size,quantity:item.quantity})),p_customer_name:cartConsent?profile.fullName:"",p_customer_email:cartConsent?(accountEmail||checkoutEmail):"",p_phone:cartConsent?profile.phone:"",p_address:cartConsent?profile.address:"",p_governorate:cartConsent?(governorate||profile.governorate):"",p_contact_consent:cartConsent}).then(({error})=>{if(!error)setCartSaved(true);});
    },700);
    return()=>window.clearTimeout(timer);
  },[cart,cartReady,signedIn,customerId,accountEmail,checkoutEmail,cartConsent,consentOwner,profile,governorate]);
  useEffect(()=>{if(profile.governorate)setGovernorate(current=>current||profile.governorate);},[profile.governorate]);
  const visible = useMemo(() => products.filter(p => (category === "الكل" || p.category === category) && `${p.name} ${p.category}`.includes(search.trim())), [products, category, search]);
  const total = cart.reduce((sum, item) => sum + effectivePrice(item.product) * item.quantity, 0);
  const availableGovernorates=EGYPT_GOVERNORATES.filter(item=>deliverySettings.delivery_zones.some(zone=>zone.governorates.includes(item)));
  const deliveryFee = calculateDeliveryFee(deliverySettings,total,governorate);
  const appliedDiscount=Math.min(couponDiscount,total);
  const totalWithDelivery = deliveryFee===null?null:total+deliveryFee-appliedDiscount;
  function notify(message: string) { setToast(message); window.setTimeout(() => setToast(""), 2700); }
  function openProduct(product: Product) { setActive(product); setColorIndex(0); setSize(product.sizes[0] || ""); setQuantity(1); }
  function addToCart() {
    if (!active) return;
    if (size.includes("مخصوص") && (!customWidth || !customHeight)) { notify("اكتبي العرض والطول عشان نعملها على مقاسك"); return; }
    const chosenSize = size.includes("مخصوص") ? `${customWidth} × ${customHeight} سم` : size;
    const picked = { product: active, color: active.colors[colorIndex], size: chosenSize, quantity };
    setCart(current => [...current, picked]); setCartSaved(false); setCouponCode(""); setCouponDiscount(0); setActive(null); notify("اتضافت للسلة، كده فاضل خطوة!"); setCustomWidth(""); setCustomHeight("");
  }
  function guestCartKey(){let key=localStorage.getItem(`${LOCAL_CART_KEY}-guest-id`);if(!key){key=crypto.randomUUID();localStorage.setItem(`${LOCAL_CART_KEY}-guest-id`,key);}return `g:${key}`;}
  function updateCartConsent(consent:boolean){
    const wasConsented=cartConsent;setCartConsent(consent);setCartSaved(false);
    if(signedIn){try{localStorage.setItem(`${LOCAL_CART_KEY}-contact:${customerId}`,consent?"yes":"no");}catch{}setConsentOwner(customerId);}
    else{try{localStorage.setItem(`${LOCAL_CART_KEY}-contact:guest`,consent?"yes":"no");}catch{}if(wasConsented&&!consent){try{void createClient().rpc("revoke_customer_cart_contact",{p_cart_key:guestCartKey()});}catch{}}}
  }
  async function saveGuestCart(){
    if(!cartConsent){notify("علّمي موافقتك على التواصل الأول.");return;}
    if(profile.fullName.trim().length<2||profile.phone.trim().length<7||profile.address.trim().length<5||!(accountEmail||checkoutEmail).trim()){notify("كمّلي الاسم والبريد والموبايل والعنوان علشان نحفظ السلة.");return;}
    setBusy(true);
    const {error}=await createClient().rpc("save_customer_cart",{p_cart_key:guestCartKey(),p_items:cart.map(item=>({product_id:item.product.id,color:item.color.name,size:item.size,quantity:item.quantity})),p_customer_name:profile.fullName,p_customer_email:(accountEmail||checkoutEmail).trim().toLowerCase(),p_phone:profile.phone,p_address:profile.address,p_governorate:governorate||profile.governorate,p_contact_consent:true});
    setBusy(false);
    if(error){notify(error.code==="PGRST202"?"شغّلي ترحيل السلات المتروكة في Supabase أولاً.":"تعذر حفظ السلة. راجعي البيانات وحاولي تاني.");return;}
    setCartSaved(true);notify("اتحفظت السلة. هنستخدم بياناتك للتواصل بخصوصها والعروض.");
  }
  const [customWidth, setCustomWidth] = useState(""), [customHeight, setCustomHeight] = useState("");
  async function submitOrder(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); if (!isSupabaseConfigured) { notify("اربطوا المشروع بـ Supabase الأول عشان نستقبل الطلب"); return; }
    if(!governorate){notify("اختاري محافظة التوصيل عشان نحدد الرسوم.");return;}
    setBusy(true); const form = new FormData(event.currentTarget);
    const payload = cart.map(item => ({ product_id:item.product.id, color:item.color.name, size:item.size, quantity:item.quantity }));
    try {
      const supabase = createClient();
      const submittedProfile:CustomerProfile={fullName:String(form.get("customer")||"").trim(),phone:String(form.get("phone")||"").trim(),address:String(form.get("address")||"").trim(),governorate};
      const submittedEmail=(accountEmail||String(form.get("customer_email")||"")).trim().toLowerCase();
      const orderArgs={p_customer_name:submittedProfile.fullName,p_phone:submittedProfile.phone,p_address:submittedProfile.address,p_governorate:governorate,p_customer_email:submittedEmail,p_coupon_code:couponCode,p_notes:String(form.get("notes")||""),p_items:payload};
      let {data:orderId,error}=await supabase.rpc("place_order",orderArgs);let accountsReady=true;
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
      if (error) throw error;
      if(!orderId)throw new Error("order id missing");
      setProfile(submittedProfile);
      if(signedIn)void supabase.auth.updateUser({data:profileToMetadata(submittedProfile)}).then(({error:profileError})=>{if(profileError)console.error("Unable to save customer contact details.",profileError);});
      setPendingEmail(accountsReady?submittedEmail:"");setPendingProfile(submittedProfile);setCustomerAccountsReady(accountsReady);setCart([]);setCheckoutOpen(false);setCartOpen(false);setTrackingOrderId(orderId);notify("طلبك اتسجل، هتلاقي رابط المتابعة تحت");
    } catch (error) { const code=(error as {code?:string})?.code; notify(code==="coupon_migration_required"?"شغّلي ترحيل العروض والكوبونات في Supabase قبل استخدام الكود.":code==="PGRST202"?"شغّلي ترحيل حسابات العملاء في Supabase قبل استقبال الطلبات.":"حصلت مشكلة في الطلب. جرّبي تاني أو كلمينا."); console.error(error); }
    finally { setBusy(false); }
  }
  return <>
    <div className="announcement">تفاصيل يدوية معمولة بحب، مخصوص ليكي <span>✳</span> اختاري محافظتك لمعرفة رسوم التوصيل</div>
    <header className="site-header"><Link className="brand" href="/#home"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link>
      <nav className={`main-nav ${menuOpen ? "open" : ""}`}><Link className={!initialCategory&&!categoryIndex?"active":""} href="/#home">الرئيسية</Link><Link className={initialCategory||categoryIndex?"active":""} href="/categories">تسوقي المنتجات</Link><Link href={signedIn?"/account":"/account/login"}>{signedIn?`حسابي${profile.fullName?` · ${profile.fullName}`:""}`:"دخول / طلباتي"}</Link><Link href="/#story">حكايتنا</Link><Link href="/#custom">اعمليها على ذوقك</Link></nav>
      <div className="header-actions"><button className="icon-button" aria-label="بحث" onClick={() => document.getElementById("shop-search")?.focus()}><Search size={18}/></button><button className="icon-button bag-button" aria-label="سلة التسوق" onClick={() => setCartOpen(true)}><ShoppingBag size={19}/><i>{cart.reduce((sum,item)=>sum+item.quantity,0)}</i></button><Link className="admin-entry" href="/dashboard">إدارة المتجر <span>↗</span></Link><button className="menu-toggle" aria-label="القائمة" onClick={() => setMenuOpen(!menuOpen)}><Menu size={18}/></button></div>
    </header>
    <main id="home">
      {!initialCategory&&!categoryIndex&&<><section className="hero"><Image src="/hero.png" alt="حائط مشمس وقطعة مكرمية قطنية مصنوعة يدوياً" fill priority sizes="100vw" className="hero-image"/><div className="hero-shade"/><div className="hero-copy"><span className="eyebrow light">حكاية كل عقدة بتبدأ بخيط</span><h1>تفاصيل صغيرة<br/>تخلّي البيت <em>بيتك.</em></h1><p>ستائر ومكرميات معمولة بإيدين بتحب الشغل الحلو. قطعة مخصوص ليكي، على المقاس واللون اللي بتحلمي بيه.</p><div className="hero-actions"><a className="button button-light" href="#shop">اكتشفي التشكيلة <span>←</span></a><a className="text-link light-link" href="#story">حكايتنا <span>↗</span></a></div></div><div className="hero-note"><span>01 / 03</span><b>قطعة فريدة، معمولة ليكي</b><small>Handmade in Cairo · Est. 2021</small></div><div className="hero-scroll">اكتشفي المزيد <span>↓</span></div></section><section className="ticker"><div>صناعة بإيدينا <span>✳</span> خامات طبيعية <span>✳</span> على مقاسك <span>✳</span> كل قطعة ليها حكاية <span>✳</span> صناعة بإيدينا <span>✳</span> خامات طبيعية</div></section></>}
      {initialCategory&&<section className={`category-hero ${initialCategoryImage?"has-category-cover":""}`}>{initialCategoryImage&&<><Image className="category-hero-image" src={initialCategoryImage} alt="" fill sizes="100vw"/><div className="category-hero-shade"/></>}<div className="category-hero-copy"><span className="eyebrow">من إيدينا لبيتك · {categoryItems.find(item=>item.name===initialCategory)?.english}</span><h1>{initialCategory}<em>، على ذوقك.</em></h1><p>{categoryDescription}</p><span className="category-count">{new Intl.NumberFormat("ar-EG").format(visible.length)} قطعة متاحة <i>✳</i> كلها معمولة بحب</span></div></section>}
      {categoryIndex&&<section className="categories-landing section"><span className="eyebrow">تشكيلتنا</span><h1>اختاري <em>الصنف.</em></h1><p className="categories-intro">كل مجموعة معمولة بإيدينا، بخامات طبيعية وتفاصيل تتظبط على بيتك.</p><div className="category-card-grid">{categoryItems.map(item=>{const count=products.filter(product=>product.category===item.name).length;return <Link href={`/category/${item.slug}`} key={item.slug} className="category-card"><div className={`category-visual ${item.style} has-category-image`}><Image src={item.image_url||categoryFallbackImages[item.slug]} alt={item.name} fill sizes="(max-width: 640px) 100vw, 33vw"/><span>{item.number}</span><i>✳</i></div><div className="category-card-meta"><div><small>{item.english}</small><h2>{item.name}</h2><p>{item.description}</p><span>{new Intl.NumberFormat("ar-EG").format(count)} منتجات</span></div><b>←</b></div></Link>})}</div></section>}
      {!categoryIndex&&<section className="section products-section" id="shop"><div className="section-top"><div><span className="eyebrow">{initialCategory?"تشكيلة معمولة بحب":"من إيدينا لبيتك"}</span><h2>{initialCategory?initialCategory:<>اختاري القطعة<br/><em>اللي شبهك.</em></>}</h2></div><Link className="text-link" href="/categories">كل الأصناف <span>←</span></Link></div><div className="shop-tools"><div className="filters"><Link href="/categories" className="filter">كل الأصناف</Link>{categoryItems.map(item=><Link key={item.slug} href={`/category/${item.slug}`} className={`filter ${initialCategory===item.name?"active":""}`}>{item.name}</Link>)}</div><label className="search-box"><Search size={15}/><input id="shop-search" value={search} onChange={e=>setSearch(e.target.value)} placeholder="دوري على قطعة..."/></label></div>
        <div className="product-grid">{visible.map(product=><article className="product-card" key={product.id}><div className="product-image"><ProductArt product={product}/>{product.badge&&<span className="badge">{product.badge}</span>}{product.sale_price&&product.sale_price<product.price&&<span className="sale-badge">عرض</span>}<Link className="product-card-hit" href={`/product/${product.slug}`} aria-label={`تفاصيل ${product.name}`}/><button type="button" className="quick-add" onClick={()=>openProduct(product)}>اختاري المقاس واللون <span>←</span></button></div><div className="product-meta"><div><h3><Link href={`/product/${product.slug}`}>{product.name}</Link></h3><p>{product.category} · {product.colors.length} ألوان</p></div><span className="product-price">{product.sale_price&&product.sale_price<product.price?<><del>{egp(product.price)}</del>{egp(product.sale_price)}</>:egp(product.price)}</span></div></article>)}{visible.length===0&&<div className="no-results">ملقيناش القطعة دي، جربي كلمة تانية.</div>}</div>
      </section>}
      {!initialCategory&&!categoryIndex&&<><section className="custom-banner" id="custom"><div className="custom-photo"/><div className="custom-copy"><span className="eyebrow light">قطعتك. اختيارك.</span><h2>اتخيّليها.<br/><em>واحنا نعملها.</em></h2><p>لونك المفضل؟ مقاس مخصوص؟ حكاية عايزة تدخّلها بيتك؟ كل تفاصيل القطعة بتتعمل على ذوقك.</p><button className="button button-outline" onClick={()=>document.getElementById("shop")?.scrollIntoView({behavior:"smooth"})}>اختاري قطعة بمقاس مخصوص <span>←</span></button></div><div className="custom-stamp">HANDMADE<br/><b>WITH LOVE</b><br/>✳</div></section><section className="story section" id="story"><div className="story-art"><Image src="/images/products/mawg-wave-macrame.png" alt="مكرمية حائط يدوية بعقد قطنية طبيعية" fill sizes="(max-width: 640px) 100vw, 50vw" className="story-art-image"/><div className="story-circle">صناعة<br/>بإيدينا <span>✳</span></div><span className="story-caption">كل خيط بيبدأ بحكاية</span></div><div className="story-copy"><span className="eyebrow">من ورشة صغيرة بحب كبير</span><h2>مش مجرد ديكور.<br/><em>دي حكاية بإيدينا.</em></h2><p>مكرمية بدأت بحب الخامات الطبيعية وتفاصيل الحِرفة اللي بتدوم. كل عقدة بتتعمل على مهلك، وكل قطعة بنعملها مخصوص عشان تلاقي مكانها في بيت دافي.</p><a className="text-link" href="#custom">اطلبي قطعة مخصوص <span>←</span></a><div className="story-numbers"><div><b>١٠٠٪</b><span>شغل إيدوي</span></div><div><b>على مقاسك</b><span>تفاصيل حسب اختيارك</span></div><div><b>من القاهرة</b><span>بكل حب</span></div></div></div></section><section className="quote"><span>“</span><p>كل عقدة بتتعمل على مهلك، وكل قطعة بتلاقي مكانها في بيت دافي.</p><small>مكرمية <i>✳ ✳ ✳ ✳ ✳</i></small></section><section className="newsletter"><div><span className="eyebrow">خليكي قريبة</span><h2>حاجات حلوة جاية.</h2></div><p>تابعي تشكيلتنا الجديدة والقطع اللي بنعملها مخصوص.</p><Link href="/dashboard" className="text-link">إدارة المتجر <span>←</span></Link></section></>}
    </main>
    <footer className="footer"><Link className="brand footer-brand" href="/#home"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link><p>تفاصيل بتتعمل بحب، لبيوت بتتحب.</p><div><Link href="/categories">تسوقي الأصناف</Link><Link href="/account/login">حسابي وطلباتي</Link><Link href="/#story">حكايتنا</Link><Link href="/#custom">طلب مخصوص</Link></div><small>© {new Date().getFullYear()} مكرمية. كل قطعة بتحكي حكاية.</small></footer>

    {(active || cartOpen) && <div className="overlay open" onClick={()=>{setActive(null);setCartOpen(false)}}/>}
    <aside className={`drawer ${active||cartOpen?"open":""}`} aria-hidden={!active&&!cartOpen}>
      <button className="close-button" onClick={()=>{setActive(null);setCartOpen(false)}} aria-label="إغلاق"><X/></button>
      {active&&<div className="drawer-content"><div className="detail-art"><ProductArt product={active} detail/></div><span className="eyebrow">{active.category} · شغل إيدوي</span><h2>{active.name}</h2><div className="detail-price">{active.sale_price&&active.sale_price<active.price?<><del>{egp(active.price)}</del>{egp(active.sale_price)}</>:egp(active.price)}</div><p>{active.description}</p><label className="option-label">اختاري اللون</label><div className="swatches">{active.colors.map((color,index)=><button key={color.name} className={`swatch ${index===colorIndex?"selected":""}`} title={color.name} aria-label={color.name} style={{background:color.hex}} onClick={()=>setColorIndex(index)}/>)}</div><small className="color-name">{active.colors[colorIndex]?.name}</small><label className="option-label" htmlFor="size-choice">المقاس المناسب ليكي</label><select id="size-choice" className="admin-select" value={size} onChange={e=>setSize(e.target.value)}>{active.sizes.map(item=><option key={item}>{item}</option>)}</select>{size.includes("مخصوص")&&<div className="size-fields"><input inputMode="numeric" value={customWidth} onChange={e=>setCustomWidth(e.target.value)} placeholder="العرض بالسنتيمتر"/><input inputMode="numeric" value={customHeight} onChange={e=>setCustomHeight(e.target.value)} placeholder="الطول بالسنتيمتر"/></div>}<div className="quantity-row"><span>الكمية</span><div className="quantity-control"><button onClick={()=>setQuantity(Math.max(1,quantity-1))}><Minus size={13}/></button><span>{quantity}</span><button onClick={()=>setQuantity(quantity+1)}><Plus size={13}/></button></div></div><button className="add-cart" onClick={addToCart}>أضيفي للسلة · {egp(effectivePrice(active)*quantity)} <ArrowLeft size={16}/></button></div>}
      {cartOpen&&<div className="drawer-content cart-drawer">
        <span className="eyebrow">اختياراتك الحلوة</span><h2>سلة التسوق</h2>
        {cart.length?<>
          <div className="cart-lines">{cart.map((item,index)=><div className="admin-card cart-line" key={`${item.product.id}-${index}`}><div><b>{item.product.name}</b><p>{item.color.name} · {item.size} · {item.quantity} قطعة</p></div><strong>{egp(effectivePrice(item.product)*item.quantity)}</strong><button className="remove-item" onClick={()=>{setCart(current=>current.filter((_,i)=>i!==index));setCouponCode("");setCouponDiscount(0);setCartSaved(false);}} aria-label="حذف"><X size={15}/></button></div>)}</div>
          <div className="cart-recovery-panel"><b>{signedIn?"سلتك بتتحفظ تلقائيًا على حسابك":"احفظي سلتك لو حابة ترجعي لها"}</b><p>{signedIn?"ممكن توافقي كمان إننا نتواصل معاكي بخصوصها أو بعروض المتجر.":"اكتبي بياناتك ووافقي على التواصل، عشان نقدر نرجعلك بعرض مناسب."}</p>
            <label className="consent-field"><input type="checkbox" checked={cartConsent} onChange={event=>updateCartConsent(event.target.checked)}/><span>أوافق على التواصل معي بخصوص السلة والعروض</span></label>
            {(!signedIn||!profile.fullName||!profile.phone||!profile.address)&&<div className="recovery-contact-fields"><input value={profile.fullName} onChange={event=>setProfile(current=>({...current,fullName:event.target.value}))} placeholder="الاسم"/><input value={signedIn?accountEmail:checkoutEmail} readOnly={signedIn} onChange={event=>setCheckoutEmail(event.target.value)} placeholder="البريد الإلكتروني"/><input value={profile.phone} onChange={event=>setProfile(current=>({...current,phone:event.target.value}))} placeholder="رقم الموبايل"/><input value={profile.address} onChange={event=>setProfile(current=>({...current,address:event.target.value}))} placeholder="العنوان"/></div>}
            {signedIn?<small className="recovery-saved-note">{cartSaved?"اتحفظت السلة على حسابك.":"السلة هتتحفظ تلقائيًا بعد لحظات."}</small>:<button className="recovery-save-button" onClick={()=>void saveGuestCart()} disabled={busy}>{busy?"جاري الحفظ...":"احفظي السلة وبيانات التواصل"}</button>}
          </div>
          <label className="delivery-governorate-select">محافظة التوصيل<select value={governorate} onChange={event=>setGovernorate(event.target.value)}><option value="">اختاري المحافظة</option>{availableGovernorates.map(item=><option key={item} value={item}>{item}</option>)}</select></label>
          <div className="delivery-cost-summary"><div><span>قيمة المنتجات</span><b>{egp(total)}</b></div><div><span>رسوم التوصيل</span><b>{deliveryFee===null?"اختاري المحافظة":deliveryFee===0?"مجاني":egp(deliveryFee)}</b></div><div className="delivery-total"><span>الإجمالي التقريبي</span><b>{deliveryFee===null?"اختاري المحافظة":egp(total+deliveryFee)}</b></div></div>
          <small className="shipping-note">{deliverySettings.customer_note} · مدة التوصيل {deliveryWindow(deliverySettings)}</small><button className="add-cart" onClick={()=>{setCartOpen(false);setCheckoutOpen(true)}}>كمّلي الطلب <ArrowLeft size={16}/></button>
        </>:<div className="empty-state"><span>♧</span>السلة لسه فاضية.<br/>كل بيت بيستاهل قطعة معمولة بحب.</div>}
      </div>}
    </aside>
    {checkoutOpen&&<div className="modal-wrap open" onClick={e=>{if(e.target===e.currentTarget)setCheckoutOpen(false)}}>
      <div className="modal"><button className="close-button" onClick={()=>setCheckoutOpen(false)} aria-label="إغلاق"><X/></button><span className="eyebrow">خطوة واحدة وتبقى ليكي</span><h2>بيانات الطلب</h2><p>هنكلمك نأكد كل التفاصيل قبل ما نبدأ الشغل.</p>
        <div className="admin-card summary-card"><label className="delivery-governorate-select">محافظة التوصيل<select value={governorate} onChange={event=>setGovernorate(event.target.value)}><option value="">اختاري المحافظة</option>{availableGovernorates.map(item=><option key={item} value={item}>{item}</option>)}</select></label>{cart.map((item,index)=><div key={index}>{item.product.name} · {item.color.name} · {item.size} × {item.quantity}</div>)}<hr/><CouponField subtotal={total} initialCode={couponCode} onApplied={(code,discount)=>{setCouponCode(code);setCouponDiscount(discount);}}/><div className="delivery-cost-summary checkout-delivery-summary"><div><span>قيمة المنتجات</span><b>{egp(total)}</b></div>{appliedDiscount>0&&<div className="coupon-discount-row"><span>خصم الكوبون {couponCode}</span><b>− {egp(appliedDiscount)}</b></div>}<div><span>رسوم التوصيل</span><b>{deliveryFee===null?"اختاري المحافظة":deliveryFee===0?"مجاني":egp(deliveryFee)}</b></div><div className="delivery-total"><span>الإجمالي المتوقع</span><b>{totalWithDelivery===null?"اختاري المحافظة":egp(totalWithDelivery)}</b></div><small>{governorate?`التوصيل إلى ${governorate}`:"اختاري المحافظة لمعرفة الرسوم"} · {deliveryWindow(deliverySettings)}</small></div></div>
        <form className="order-form" onSubmit={submitOrder}><input type="hidden" name="governorate" value={governorate}/><input name="customer" required minLength={2} maxLength={120} autoComplete="name" value={profile.fullName} onChange={event=>setProfile(current=>({...current,fullName:event.target.value}))} placeholder="اسمك بالكامل"/><input name="phone" type="tel" required minLength={7} maxLength={30} autoComplete="tel" value={profile.phone} onChange={event=>setProfile(current=>({...current,phone:event.target.value}))} placeholder="رقم الموبايل"/><input name="customer_email" type="email" required maxLength={254} autoComplete="email" value={accountEmail||checkoutEmail} readOnly={Boolean(accountEmail)} onChange={event=>setCheckoutEmail(event.target.value)} placeholder="البريد الإلكتروني لاسترجاع طلباتك"/><small className="checkout-email-note">{signedIn?"بياناتك محفوظة. غيري العنوان أو الرقم لو هتطلبي توصيل لمكان أو رقم جديد.":"بعد إنشاء الحساب هتتحفظ بياناتك عشان متكتبيهاش تاني."}</small><label className="consent-field checkout-consent"><input type="checkbox" checked={cartConsent} onChange={event=>updateCartConsent(event.target.checked)}/><span>أوافق على حفظ بيانات التواصل عشان المتجر يقدر يتواصل معي لو ما كملتش الطلب أو بخصوص العروض</span></label><input name="address" required minLength={5} maxLength={500} autoComplete="street-address" value={profile.address} onChange={event=>setProfile(current=>({...current,address:event.target.value}))} placeholder="عنوان التوصيل بالتفصيل"/><textarea name="notes" maxLength={1000} placeholder="ملاحظات إضافية (اختياري)"/><button className="button button-dark" disabled={busy}>{busy?"جاري تسجيل الطلب...":"أكدي الطلب"} <ArrowLeft size={15}/></button></form>
      </div>
    </div>}
    {trackingOrderId&&<div className="modal-wrap open" onClick={event=>{if(event.target===event.currentTarget)setTrackingOrderId(null)}}><section className="modal order-success-modal"><button className="close-button" onClick={()=>setTrackingOrderId(null)} aria-label="إغلاق"><X/></button><span className="eyebrow">تم حفظ الطلب فورًا</span><h2>طلبك <em>اتسجل.</em></h2><p>الطلب اتسجل قبل إنشاء الحساب. تقدري تتابعيه دلوقتي، والحساب اختياري عشان تلاقي كل طلباتك بعدين.</p><Link className="button button-dark" href={`/track/${trackingOrderId}`}>تابعي حالة الطلب <ArrowLeft size={15}/></Link><button className="track-copy-button" onClick={async()=>{try{await navigator.clipboard.writeText(`${window.location.origin}/track/${trackingOrderId}`);notify("اتنسخ رابط المتابعة")}catch{notify("افتحي رابط المتابعة واحفظيه")}}}>انسخي رابط المتابعة</button>{signedIn?<Link className="button customer-order-track-link" href="/account">ادخلي على حسابك وطلباتك <ArrowLeft size={15}/></Link>:customerAccountsReady?<CustomerAuthForm initialEmail={pendingEmail} lockEmail initialMode="signup" initialProfile={pendingProfile} compact/>:<p className="customer-account-pending">الطلب اتسجل. إنشاء الحساب هيتاح بعد تفعيل قاعدة البيانات؛ احتفظي برابط متابعة الطلب.</p>}</section></div>}
    <div className={`toast ${toast?"show":""}`} role="status">{toast}</div>
  </>;
}
