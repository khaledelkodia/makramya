import Link from "next/link";
import { ArrowLeft, Boxes, ClipboardList, PackageCheck, ShoppingBag, Wallet } from "lucide-react";
import { requireAdmin } from "@/lib/supabase/admin";

const egp=(n:number)=>new Intl.NumberFormat("ar-EG",{style:"currency",currency:"EGP",maximumFractionDigits:0}).format(n);
const statusLabels:Record<string,string>={new:"جديد",confirmed:"تم التأكيد",in_progress:"قيد التنفيذ",shipped:"تم الشحن",completed:"مكتمل",cancelled:"ملغي"};

export default async function DashboardHome() {
  const {supabase}=await requireAdmin();
  const [{data:orders},{count:orderCount},{count:productCount},{count:newCount}]=await Promise.all([
    supabase.from("orders").select("id,order_number,customer_name,status,total,created_at").order("created_at",{ascending:false}).limit(8),
    supabase.from("orders").select("id",{count:"exact",head:true}),
    supabase.from("products").select("id",{count:"exact",head:true}).eq("status","active"),
    supabase.from("orders").select("id",{count:"exact",head:true}).in("status",["new","confirmed","in_progress"]),
  ]);
  const {data:completed}=await supabase.from("orders").select("total").eq("status","completed");
  const revenue=(completed||[]).reduce((sum,row)=>sum+Number(row.total),0);
  const {data:week}=await supabase.from("orders").select("created_at").gte("created_at",new Date(Date.now()-6*86400000).toISOString());
  const chart=Array.from({length:7},(_,i)=>{const day=new Date();day.setHours(0,0,0,0);day.setDate(day.getDate()-(6-i));return {label:day.toLocaleDateString("ar-EG",{weekday:"short"}),count:(week||[]).filter(item=>new Date(item.created_at).toDateString()===day.toDateString()).length};});
  const maximum=Math.max(1,...chart.map(day=>day.count));
  return <section className="dashboard-content"><div className="dashboard-title"><div><span className="eyebrow">أهلاً بيكي في متجرك</span><h2>كل حاجة <em>تمام؟</em></h2></div><span className="today-date">{new Intl.DateTimeFormat("ar-EG",{dateStyle:"full"}).format(new Date())}</span></div>
    <div className="stats-grid dashboard-stats"><article className="stat-card"><span><ShoppingBag size={15}/> إجمالي الطلبات</span><b>{new Intl.NumberFormat("ar-EG").format(orderCount||0)}</b><small>آخر الطلبات ظاهرة تحت</small></article><article className="stat-card"><span><PackageCheck size={15}/> محتاجة متابعة</span><b>{new Intl.NumberFormat("ar-EG").format(newCount||0)}</b><small>جديد أو قيد التنفيذ</small></article><article className="stat-card"><span><Wallet size={15}/> مبيعات مكتملة</span><b>{egp(revenue)}</b><small>من الطلبات المكتملة</small></article><article className="stat-card"><span><PackageCheck size={15}/> منتجات منشورة</span><b>{new Intl.NumberFormat("ar-EG").format(productCount||0)}</b><small>معروضة في المتجر</small></article></div>
    <div className="dashboard-columns"><section className="chart-card dashboard-chart"><div className="chart-header"><h3>الطلبات خلال آخر ٧ أيام</h3><span>عدد الطلبات يومياً</span></div><div className="chart-bars">{chart.map((day,i)=><div key={i} style={{height:`${Math.max(8,day.count/maximum*88)}%`}} title={`${day.count} طلب`}><small>{day.label}</small></div>)}</div></section><section className="dashboard-shortcuts"><h3>اختصارات سريعة</h3><Link href="/dashboard/products" className="shortcut-card"><span><Boxes size={17}/></span><b>أضيفي منتج جديد</b><ArrowLeft size={15}/></Link><Link href="/dashboard/orders" className="shortcut-card"><span><ClipboardList size={17}/></span><b>راجعي الطلبات</b><ArrowLeft size={15}/></Link></section></div>
    <section className="admin-card recent-table"><div className="panel-title"><h3>أحدث الطلبات</h3><Link href="/dashboard/orders" className="text-link">كل الطلبات <ArrowLeft size={14}/></Link></div>{orders?.length?<div className="responsive-table"><table><thead><tr><th>رقم الطلب</th><th>العميلة</th><th>التاريخ</th><th>الإجمالي</th><th>الحالة</th></tr></thead><tbody>{orders.map(order=><tr key={order.id}><td>MK-{order.order_number}</td><td>{order.customer_name}</td><td>{new Intl.DateTimeFormat("ar-EG",{dateStyle:"medium"}).format(new Date(order.created_at))}</td><td>{egp(Number(order.total))}</td><td><span className={`status status-${order.status}`}>{statusLabels[order.status]}</span></td></tr>)}</tbody></table></div>:<div className="empty-state"><span>✳</span>لسه مفيش طلبات. أول طلب هيظهر هنا.</div>}</section>
  </section>;
}
