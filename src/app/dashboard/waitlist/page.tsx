import Link from "next/link";
import { redirect } from "next/navigation";
import { removeWaitlistEntry } from "@/actions/waitlist";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function WaitlistPage() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/onboarding");
  if (member.role !== "owner" && member.role !== "admin") redirect("/dashboard");
  const admin = createSupabaseAdminClient();
  const [{ data: entries }, { data: services }, { data: staff }] = await Promise.all([
    admin.from("waitlist_entries").select("id, service_id, preferred_staff_id, preferred_date, full_name, email, phone, status").eq("business_id", member.business_id).order("created_at", { ascending: false }),
    admin.from("services").select("id, name").eq("business_id", member.business_id),
    admin.from("staff").select("id, name").eq("business_id", member.business_id),
  ]);
  const serviceNames = new Map((services ?? []).map((service) => [service.id, service.name]));
  const staffNames = new Map((staff ?? []).map((person) => [person.id, person.name]));
  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#20241f] sm:px-8 sm:py-12"><div className="mx-auto max-w-5xl">
    <Link href="/dashboard" className="text-sm font-medium text-[#52624f]">← Kontrolna tabla</Link><h1 className="mt-8 text-3xl font-semibold">Lista čekanja</h1>
    <p className="mt-2 text-sm text-[#737c71]">Prvo se obaveštava najstarija prijava koja odgovara oslobođenom terminu.</p>
    <div className="mt-6 space-y-3">{(entries ?? []).map((entry) => <article key={entry.id} className="flex flex-wrap items-center justify-between gap-4 rounded-2xl border border-[#e9ece5] bg-white p-4 sm:p-5">
      <div><h2 className="font-semibold">{entry.full_name}</h2><p className="mt-1 text-sm text-[#667064]">{entry.email}{entry.phone ? ` · ${entry.phone}` : ""}</p><p className="mt-1 text-xs text-[#737c71]">{entry.preferred_date} · {serviceNames.get(entry.service_id) ?? "Usluga"} · {entry.preferred_staff_id ? staffNames.get(entry.preferred_staff_id) ?? "Zaposleni" : "Bilo ko"}</p></div>
      <div className="flex items-center gap-3"><span className="rounded-full bg-[#edf4ea] px-3 py-1 text-xs font-semibold">{entry.status === "waiting" ? "Čeka" : entry.status === "notified" ? "Obavešten/a" : entry.status}</span><form action={removeWaitlistEntry}><input type="hidden" name="entryId" value={entry.id} /><button className="rounded-lg border border-[#e3e7df] px-3 py-2 text-xs font-semibold">Ukloni</button></form></div>
    </article>)}{!entries?.length && <p className="rounded-2xl border border-[#e9ece5] bg-white p-6 text-sm text-[#737c71]">Lista čekanja je prazna.</p>}</div>
  </div></main>;
}
