import Link from "next/link";
import { redirect } from "next/navigation";
import { BusinessRulesForm } from "@/components/dashboard/admin-forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/onboarding");
  if (member.role !== "owner" && member.role !== "admin") redirect("/dashboard");
  const { data: business } = await supabase.from("businesses").select("name, min_notice_minutes, max_days_ahead, cancel_window_hours").eq("id", member.business_id).single();
  if (!business) redirect("/dashboard");

  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#20241f] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-4xl">
      <Link href="/dashboard" className="text-sm font-medium text-[#52624f]">← Kontrolna tabla</Link>
      <p className="mt-8 text-sm font-medium text-[#718a70]">{business.name}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em]">Pravila zakazivanja</h1>
      <p className="mt-2 text-sm text-[#737c71]">Ova ograničenja važe za javno zakazivanje i link za upravljanje terminom.</p>
      <section className="mt-7 rounded-2xl border border-[#e9ece5] bg-white p-6 sm:p-8"><BusinessRulesForm rules={business} /></section>
      <Link href="/dashboard/time-off" className="mt-5 inline-flex rounded-xl border border-[#e3e7df] bg-white px-4 py-3 text-sm font-medium text-[#405243]">Upravljanje odsustvima →</Link>
    </div>
  </main>;
}
