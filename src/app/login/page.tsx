import type { Metadata } from "next";
import Link from "next/link";
import { loginAdmin } from "@/app/actions";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export const metadata: Metadata = { title:"دخول الإدارة", robots:{index:false,follow:false} };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ error?:string; setup?:string }> }) {
  const params = await searchParams;
  const messages: Record<string,string> = { credentials:"البريد الإلكتروني أو كلمة المرور مش صحيحة.", unauthorized:"الحساب ده مش مضاف كمسؤولة للمتجر.", missing:"اكتبي البريد الإلكتروني وكلمة المرور." };
  return <main className="login-page"><Link href="/" className="brand"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>حرفة يدوية بلمسة من البيت</small></span></Link><section className="login-card"><span className="eyebrow">مساحة صاحبة الشغل</span><h1>أهلاً بيكي <em>تاني.</em></h1><p>سجّلي دخولك عشان تديري المنتجات والطلبات.</p>{(params.setup||!isSupabaseConfigured)&&<div className="notice-box">المشروع جاهز، وفاضل إعدادات Supabase. انسخي <code>.env.example</code> إلى <code>.env.local</code> واكملي بيانات المشروع حسب ملف README.</div>}{params.error&&<div className="form-error">{messages[params.error]||"حصلت مشكلة أثناء تسجيل الدخول."}</div>}<form action={loginAdmin} className="order-form"><label>البريد الإلكتروني<input name="email" type="email" autoComplete="username" required placeholder="name@example.com"/></label><label>كلمة المرور<input name="password" type="password" autoComplete="current-password" required placeholder="كلمة المرور"/></label><button className="button button-dark">دخول للداشبورد <span>←</span></button></form></section><Link className="login-back" href="/">رجوع للمتجر <span>←</span></Link></main>;
}
