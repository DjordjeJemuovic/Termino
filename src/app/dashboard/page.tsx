import { redirect } from "next/navigation";
import { connection } from "next/server";
import { DashboardOverview } from "@/components/dashboard/dashboard-overview";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function DashboardPage() {
  await connection();
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await supabase.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  const { data: business } = await supabase.from("businesses").select("name, slug").eq("id", membership.business_id).single();
  return <DashboardOverview role={membership.role} businessName={business?.name} slug={business?.slug} email={user.email} />;
}
