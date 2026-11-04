import type { Metadata } from "next";
import { requireAdmin } from "@/lib/supabase/admin";
import { createServiceClient } from "@/lib/supabase/service";
import { StaffManager, type StaffUser } from "@/components/staff-manager";
import type { StaffRole } from "@/lib/types";

export const metadata:Metadata={title:"فريق المتجر"};

export default async function StaffPage(){
  const {user}=await requireAdmin(["owner"]);
  let staff:StaffUser[]=[];let setupMessage="";
  try{
    const service=createServiceClient();
    const [{data:members,error:membersError},{data:authUsers,error:usersError}]=await Promise.all([
      service.from("admins").select("user_id, role, created_at").order("created_at",{ascending:true}),
      service.auth.admin.listUsers({page:1,perPage:200}),
    ]);
    const error=membersError||usersError;
    if(error){
      setupMessage=error.code==="42703"||error.message.toLowerCase().includes("role")?"شغّلي ترحيل صلاحيات المستخدمين في Supabase قبل إدارة الفريق.":"تعذر تحميل الفريق. راجعي إعداد SUPABASE_SERVICE_ROLE_KEY في Vercel.";
    }else{
      const emails=new Map((authUsers?.users||[]).map(account=>[account.id,account.email||""]));
      staff=(members||[]).flatMap(member=>{
        const email=emails.get(member.user_id);if(!email)return[];
        return[{id:member.user_id,email,role:member.role as StaffRole,createdAt:member.created_at}];
      });
    }
  }catch{
    setupMessage="أضيفي SUPABASE_SERVICE_ROLE_KEY كمتغير سري في إعدادات Vercel، ثم أعيدي نشر الموقع.";
  }
  return <section className="dashboard-content"><StaffManager staff={staff} currentUserId={user.id} setupMessage={setupMessage||undefined}/></section>;
}
