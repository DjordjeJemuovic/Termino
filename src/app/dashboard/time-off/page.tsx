import Link from "next/link";
import { redirect } from "next/navigation";
import { deleteTimeOff } from "@/actions/time-off";
import { TimeOffForm } from "@/components/dashboard/admin-forms";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function TimeOffPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/onboarding");
  if (member.role !== "owner" && member.role !== "admin") redirect("/dashboard");
  const [{ data: business }, { data: staff }, { data: absences, error }] = await Promise.all([
    supabase.from("businesses").select("name, timezone").eq("id", member.business_id).single(),
    supabase.from("staff").select("id, name").eq("business_id", member.business_id).order("name"),
    supabase.from("time_off").select("id, staff_id, starts_at, ends_at, reason").eq("business_id", member.business_id).order("starts_at"),
  ]);
  if (!business) redirect("/dashboard");
  const staffById = new Map((staff ?? []).map((person) => [person.id, person.name]));
  const formatter = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: business.timezone, dateStyle: "medium", timeStyle: "short" });

  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#20241f] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard" className="text-sm font-medium text-[#52624f]">← Kontrolna tabla</Link>
      <p className="mt-8 text-sm font-medium text-[#718a70]">{business.name}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em]">Odsustva i praznici</h1>
      <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className="rounded-2xl border border-[#e9ece5] bg-white p-6"><h2 className="mb-5 font-semibold">Dodaj odsustvo</h2><TimeOffForm staff={staff ?? []} /></section>
        <section className="rounded-2xl border border-[#e9ece5] bg-white p-6"><h2 className="mb-4 font-semibold">Uneta odsustva</h2>
          {error && <p role="alert" className="text-sm text-[#a34231]">Odsustva nisu mogla da se učitaju.</p>}
          {!error && absences?.length === 0 && <p className="text-sm text-[#7b8379]">Nema unetih odsustava.</p>}
          <ul className="space-y-3">{(absences ?? []).map((absence) => <li key={absence.id} className="flex items-start justify-between gap-4 rounded-xl bg-[#f7f8f5] p-4">
            <div><p className="text-sm font-semibold">{absence.staff_id ? staffById.get(absence.staff_id) ?? "Zaposleni" : "Ceo salon / praznik"}</p>
              <p className="mt-1 text-xs text-[#737c71]">{formatter.format(new Date(absence.starts_at))} – {formatter.format(new Date(absence.ends_at))}</p>
              {absence.reason && <p className="mt-1 text-xs text-[#737c71]">{absence.reason}</p>}</div>
            <form action={deleteTimeOff}><input type="hidden" name="timeOffId" value={absence.id} /><button className="text-xs font-semibold text-[#a34231]">Obriši</button></form>
          </li>)}</ul>
        </section>
      </div>
    </div>
  </main>;
}
