import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, Clock3 } from "lucide-react";
import { WorkingHoursForm } from "@/components/staff/working-hours-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StaffHoursPage({ params }: { params: Promise<{ staffId: string }> }) {
  const { staffId } = await params;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/dashboard");

  const { data: staff } = await supabase
    .from("staff")
    .select("id, name, color")
    .eq("id", staffId)
    .eq("business_id", membership.business_id)
    .maybeSingle();
  if (!staff) notFound();

  const { data: intervals, error } = await supabase
    .from("working_hours")
    .select("weekday, start_time, end_time")
    .eq("staff_id", staff.id)
    .order("weekday")
    .order("start_time");

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#20241f]">
      <header className="border-b border-[#e9ece5] bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/dashboard/staff" className="flex items-center gap-2 text-sm font-medium text-[#52624f] hover:text-[#304b36]"><ArrowLeft size={16} /> Zaposleni</Link>
          <span className="text-sm text-[#737c71]">{user.email}</span>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="mb-7 flex items-center gap-3">
          <span className="flex size-11 items-center justify-center rounded-xl bg-[#edf3e9] text-[#557454]"><Clock3 size={20} /></span>
          <div>
            <p className="text-sm font-medium text-[#718a70]">Radno vreme zaposlenog</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em]">{staff.name}</h1>
          </div>
          <span className="ml-auto size-8 rounded-xl border border-black/5" style={{ backgroundColor: staff.color }} />
        </div>

        {error ? (
          <p role="alert" className="rounded-xl bg-[#fff0ed] p-4 text-sm text-[#a34231]">Radno vreme nije moglo da se učita.</p>
        ) : (
          <WorkingHoursForm staffId={staff.id} initialIntervals={intervals ?? []} />
        )}
      </div>
    </main>
  );
}
