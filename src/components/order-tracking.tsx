import Link from "next/link";
import { ArrowLeft, Check, Clock3, Package, Truck } from "lucide-react";
import type { CustomerOrderTracking, OrderStatus } from "@/lib/types";

const statuses:OrderStatus[]=["new","confirmed","in_progress","shipped","completed"];
const labels:Record<OrderStatus,string>={new:"وصلنا الطلب",confirmed:"اتأكد الطلب",in_progress:"بنجهّز طلبك",shipped:"في الطريق ليكي",completed:"تم التسليم",cancelled:"تم الإلغاء"};
const egp=(value:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(value);
function dateTime(value:string){return new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium",timeStyle:"short"}).format(new Date(value));}

export function OrderTracking({order}:{order:CustomerOrderTracking|null}){
  if(!order)return <main className="track-page"><div className="track-card track-not-found"><span className="eyebrow">متابعة الطلب</span><h1>مش لاقيين الطلب ده.</h1><p>راجعي رابط المتابعة اللي ظهر بعد تأكيد الطلب، أو كلمينا لو محتاجة مساعدة.</p><Link href="/categories" className="button button-dark">ارجعي للمتجر <ArrowLeft size={15}/></Link></div></main>;
  const currentIndex=statuses.indexOf(order.status);
  const cancelled=order.status==="cancelled";
  return <main className="track-page"><header className="track-header"><Link className="brand" href="/"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link><Link href="/categories" className="track-back">العودة للمتجر <ArrowLeft size={14}/></Link></header><div className="track-content"><section className="track-heading"><span className="eyebrow">متابعة طلبك</span><h1>طلب <em>MK-{order.order_number}</em></h1><p>تقدري تشوفي آخر مرحلة وصل لها طلبك من هنا.</p></section>
    <section className="track-card track-progress"><div className="track-card-heading"><div><span className="eyebrow">الحالة الحالية</span><h2>{labels[order.status]}</h2></div><span className={`track-current-icon ${cancelled?"cancelled":""}`}>{cancelled?<Clock3 size={20}/>:order.status==="shipped"?<Truck size={20}/>:<Package size={20}/>}</span></div>
      {cancelled?<div className="track-cancelled">تم إلغاء الطلب. لو محتاجة تعرفي تفاصيل أكتر، تواصلي معانا.</div>:<div className="track-steps">{statuses.map((status,index)=>{const done=index<=currentIndex;const active=index===currentIndex;return <div className={`track-step ${done?"done":""} ${active?"active":""}`} key={status}><span className="track-step-mark">{done?<Check size={14}/>:index+1}</span><b>{labels[status]}</b></div>})}</div>}
      <small className="track-last-updated">آخر تحديث: {dateTime(order.updated_at)}</small>
    </section>
    <section className="track-card track-history"><div className="track-section-heading"><div><span className="eyebrow">خطوات الطلب</span><h2>سجل المتابعة</h2></div><span className="track-created">اتعمل {dateTime(order.created_at)}</span></div><ol>{order.history.map((event,index)=><li key={`${event.status}-${event.created_at}-${index}`}><span className={`history-dot ${index===order.history.length-1?"latest":""}`}/><div><b>{labels[event.status]}</b><p>{event.customer_note}</p><small>{dateTime(event.created_at)}</small></div></li>)}</ol></section>
    <div className="track-private-note">رابط التتبع خاص بالطلب. احتفظي به للرجوع للحالة لاحقًا.</div><Link href="/" className="track-home-link">كمّلي تسوق <ArrowLeft size={14}/></Link></div></main>;
}
