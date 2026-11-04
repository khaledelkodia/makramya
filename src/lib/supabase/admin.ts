import { redirect } from "next/navigation";
import { createClient } from "./server";
import type { StaffRole } from "@/lib/types";

const roleValues: StaffRole[] = ["owner", "manager", "products", "orders"];

export async function requireAdmin(allowedRoles?: StaffRole[]) {
  let supabase;
  try { supabase = await createClient(); } catch { redirect("/login?setup=1"); }
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership, error: membershipError } = await supabase.from("admins").select("user_id").eq("user_id", user.id).maybeSingle();
  if (membershipError || !membership) redirect("/login?error=unauthorized");

  const { data: roleRow, error: roleError } = await supabase.from("admins").select("role").eq("user_id", user.id).maybeSingle();
  // Keep the existing single-owner deployment usable while the new role migration is being applied.
  const missingRoleColumn = Boolean(roleError && (roleError.code === "42703" || roleError.code === "PGRST204" && roleError.message.toLowerCase().includes("role")));
  const role: StaffRole = missingRoleColumn ? "owner" : roleRow?.role as StaffRole;
  if (roleError && !missingRoleColumn) redirect("/login?setup=roles");
  if (!roleValues.includes(role)) redirect("/login?error=unauthorized");
  if (allowedRoles && !allowedRoles.includes(role)) redirect("/dashboard?access=denied");
  return { supabase, user, role };
}
