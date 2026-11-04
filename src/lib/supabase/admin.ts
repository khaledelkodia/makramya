import { redirect } from "next/navigation";
import { createClient } from "./server";

export async function requireAdmin() {
  let supabase;
  try { supabase = await createClient(); } catch { redirect("/login?setup=1"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: admin } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (!admin) redirect("/?error=unauthorized");
  return { supabase, user };
}
