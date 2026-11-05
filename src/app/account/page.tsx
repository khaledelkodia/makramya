import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowUpLeft, LogOut, Package } from "lucide-react";
import { logoutCustomer } from "@/app/actions";
import { createClient } from "@/lib/supabase/server";
import type { Order, OrderItem, OrderStatus, OrderStatusHistory } from "@/lib/types";

export const metadata:Metadata={title:"حسابي وطلباتي",robots:{index:false,follow:false}};
const statusLabels:Record<OrderStatus,string>={new:"وصلنا الطلب",confirmed:"اتأكد الطلب",in_progress:"بنجهّز طلبك",shipped:"في الطريق ليكي",completed:"تم التسليم",cancelled:"تم الإلغاء"};
const egp=(value:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(value);
const dateTime=(value:string)=>new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));

export default async function CustomerAccountPage(){
  let supabase:Awaited<ReturnType<typeof createClient>>|null=null;
  try{supabase=await createClient();}catch{return <main className="track-page"><section className="track-card track-not-found"><h1>الحساب غير جاهز دلوقتي.</h1><p>إعدادات Supabase غير مكتملة. جرّبي تاني بعد شوية.</p><Link className="button button-dark" href="/account/login">تسجيل الدخول</Link></section></main>;}
  if(!supabase)return null;
  const {data:{user}}=await supabase.auth.getUser();
  if(!user)redirect("/account/login");

  const {error:claimError}=await supabase.rpc("claim_customer_orders",{});
  const {data:orders,error:ordersError}=await supabase.from("orders").select("*").eq("customer_id",user.id).order("created_at",{ascending:false}).limit(100);
  const orderRows=(orders||[]) as Order[];
  const orderIds=orderRows.map(order=>order.id);
  let orderItems:OrderItem[]=[];let orderHistory:OrderStatusHistory[]=[];let relatedError:string|undefined;
  if(orderIds.length){
    const [{data:items,error:itemsError},{data:history,error:historyError}]=await Promise.all([
      supabase.from("order_items").select("*").in("order_id",orderIds),
      supabase.from("order_status_history").select("*").in("order_id",orderIds).order("created_at",{ascending:false}),
    ]);
    orderItems=(items||[]) as OrderItem[];orderHistory=(history||[]) as OrderStatusHistory[];relatedError=itemsError?.message||historyError?.message;
  }
  const setupError=Boolean(claimError||ordersError||relatedError);
  const setupMessage=claimError?.message.includes("email_not_verified")?"أكدي بريدك الإلكتروني من رسالة التفعيل عشان تظهر طلباتك.":"لو الطلبات مش ظاهرة، تأكدي من تشغيل ترحيل حسابات العملاء في Supabase. طلبك يظل محفوظًا حتى تفعيل الربط.";

  return <main className="track-page customer-account-page">
    <header className="track-header"><Link className="brand" href="/"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link><form action={logoutCustomer}><button className="customer-logout"><LogOut size={15}/> تسجيل الخروج</button></form></header>
    <section className="customer-account-heading"><span className="eyebrow">مساحتك الخاصة</span><h1>أهلاً بيكي <em>{user.user_metadata?.full_name||orderRows[0]?.customer_name||"تاني"}.</em></h1><p>{user.email} · طلباتك محفوظة هنا، وتقدري تتابعي كل طلب في أي وقت.</p></section>
    {setupError&&<div className="notice-box customer-account-notice">{setupMessage}</div>}
    <div className="customer-order-list-heading"><div><span className="eyebrow">سجل مشترياتك</span><h2>طلباتك <em>الأخيرة.</em></h2></div><span>{new Intl.NumberFormat("ar-EG").format(orderRows.length)} طلب</span></div>
    {orderRows.length? <section className="customer-order-list">{orderRows.map(order=>{
      const currentHistory=orderHistory.filter(event=>event.order_id===order.id);
      return <article className="customer-order-card" key={order.id}>
        <div className="customer-order-top"><div><span className="eyebrow">رقم الطلب</span><h3>MK-{order.order_number}</h3><small>{dateTime(order.created_at)}</small></div><span className={`status status-${order.status}`}>{statusLabels[order.status]}</span></div>
        <div className="customer-order-items">{orderItems.filter(item=>item.order_id===order.id).map(item=><div key={item.id}><span><b>{item.product_name}</b><small>{item.color} · {item.size} · {item.quantity} قطعة</small></span><strong>{egp(Number(item.line_total))}</strong></div>)}</div>
        <div className="customer-order-address">{order.address} · {order.phone}</div>
        <div className="customer-order-summary"><span>{order.governorate||"محافظة غير محددة"} · التوصيل {egp(Number(order.delivery_fee))}</span><b>الإجمالي {egp(Number(order.total))}</b></div>
        {currentHistory.length>0&&<p className="customer-order-last-update">آخر تحديث: {currentHistory[0].customer_note}</p>}
        <Link className="customer-order-track-link" href={`/track/${order.id}`}>تفاصيل حالة الطلب <ArrowUpLeft size={15}/></Link>
      </article>;
    })}</section>:<section className="track-card customer-empty-orders"><Package size={24}/><h2>{setupError?"بنجهّز سجل الطلبات.":"لسه مفيش طلبات مرتبطة بالحساب."}</h2><p>{setupError?"طلباتك هتظهر هنا بعد تفعيل ربط حسابات العملاء.":"استخدمي نفس البريد الإلكتروني اللي سجلتيه عند الطلب، أو ابدئي أول طلب ليكي."}</p><Link className="button button-dark" href="/categories">اكتشفي المنتجات <ArrowLeft size={15}/></Link></section>}
    <Link className="track-home-link" href="/">العودة للمتجر <ArrowLeft size={14}/></Link>
  </main>;
}
