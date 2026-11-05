import Link from "next/link";
import type { Metadata } from "next";
import { Boxes, ChartNoAxesCombined, ClipboardList, Store, Truck, Users, Tags, Percent, ShoppingBag } from "lucide-react";
import { logoutAdmin } from "@/app/actions";
import { requireAdmin } from "@/lib/supabase/admin";
import { staffRoleLabels } from "@/lib/types";

export const metadata:Metadata={robots:{index:false,follow:false}};

export default async function DashboardLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { user, role } = await requireAdmin();
  const canManageProducts=["owner","manager","products"].includes(role);
  const canManageOrders=["owner","manager","orders"].includes(role);
  return <div className="dashboard-shell"><aside className="dashboard-sidebar"><Link href="/" className="brand"><span className="brand-mark">م</span><span className="brand-word">مكرمية<small>إدارة المتجر</small></span></Link><div className="admin-profile"><div className="avatar">م</div><div><b>{staffRoleLabels[role]}</b><small>{user.email}</small></div></div><nav className="dashboard-nav"><Link href="/dashboard"><ChartNoAxesCombined size={17}/> نظرة عامة</Link>{canManageProducts&&<Link href="/dashboard/products"><Boxes size={17}/> المنتجات</Link>}{canManageProducts&&<Link href="/dashboard/categories"><Tags size={17}/> إدارة الأصناف</Link>}{canManageOrders&&<Link href="/dashboard/orders"><ClipboardList size={17}/> الطلبات</Link>}{canManageOrders&&<Link href="/dashboard/abandoned-carts"><ShoppingBag size={17}/> السلات المتروكة</Link>}{canManageOrders&&<Link href="/dashboard/delivery"><Truck size={17}/> التوصيل</Link>}{["owner","manager"].includes(role)&&<Link href="/dashboard/promotions"><Percent size={17}/> العروض والكوبونات</Link>}{role==="owner"&&<Link href="/dashboard/users"><Users size={17}/> فريق المتجر</Link>}<Link href="/" target="_blank"><Store size={17}/> عرض المتجر <span>↗</span></Link></nav><form action={logoutAdmin} className="sidebar-logout"><button>تسجيل الخروج <span>↗</span></button></form></aside><main className="dashboard-main"><header className="dashboard-topbar"><div><span className="eyebrow">مساحة {staffRoleLabels[role]}</span><h1>إدارة <em>مكرمية.</em></h1></div><Link className="button button-dark" href="/">عرض المتجر <span>↗</span></Link></header>{children}<footer className="dashboard-footer">بيانات المتجر بتتحفظ بأمان في Supabase <span>●</span></footer></main></div>;
}
