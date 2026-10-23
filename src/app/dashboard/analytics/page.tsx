import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDaysToDateKey, localDateTimeToUtc, weekdayFromDateKey } from "@/lib/scheduling/time";

const money = (amount: number) => new Intl.NumberFormat("sr-Latn-RS", { style: "currency", currency: "RSD", maximumFractionDigits: 0 }).format(amount / 100);

export default async function AnalyticsPage() {
  await connection();
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/onboarding");
  if (member.role !== "owner" && member.role !== "admin") redirect("/dashboard");

  const admin = createSupabaseAdminClient();
  const { data: business } = await admin.from("businesses").select("name, timezone").eq("id", member.business_id).single();
  if (!business) redirect("/dashboard");
  const now = new Date();
  const monthStart = new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1, 12)));
  const nextMonth = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1, 12));
  const monthEnd = new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone, year: "numeric", month: "2-digit", day: "2-digit" }).format(nextMonth);
  const [{ data: appointments }, { data: services }, { data: staff }] = await Promise.all([
    admin.from("appointments").select("staff_id, service_id, starts_at, ends_at, status").eq("business_id", member.business_id)
      .gte("starts_at", localDateTimeToUtc(monthStart, "00:00", business.timezone).toISOString())
      .lt("starts_at", localDateTimeToUtc(monthEnd, "00:00", business.timezone).toISOString()),
    admin.from("services").select("id, name, price_cents").eq("business_id", member.business_id),
    admin.from("staff").select("id, name, active").eq("business_id", member.business_id),
  ]);
  const activeStaffIds = (staff ?? []).filter((person) => person.active).map((person) => person.id);
  const [{ data: hours }, { data: timeOff }] = activeStaffIds.length
    ? await Promise.all([
        admin.from("working_hours").select("staff_id, weekday, start_time, end_time").in("staff_id", activeStaffIds),
        admin.from("time_off").select("staff_id, starts_at, ends_at").eq("business_id", member.business_id)
          .lt("starts_at", localDateTimeToUtc(monthEnd, "00:00", business.timezone).toISOString())
          .gt("ends_at", localDateTimeToUtc(monthStart, "00:00", business.timezone).toISOString()),
      ])
    : [{ data: [] }, { data: [] }];

  const serviceById = new Map((services ?? []).map((service) => [service.id, service]));
  const businessAppointments = appointments ?? [];
  const activeAppointments = businessAppointments.filter((appointment) => ["confirmed", "completed", "no_show"].includes(appointment.status));
  const completed = businessAppointments.filter((appointment) => appointment.status === "completed");
  const noShows = businessAppointments.filter((appointment) => appointment.status === "no_show");
  const revenueCents = completed.reduce((sum, appointment) => sum + (serviceById.get(appointment.service_id)?.price_cents ?? 0), 0);
  const noShowRate = completed.length + noShows.length ? Math.round(noShows.length / (completed.length + noShows.length) * 100) : 0;

  let capacityMinutes = 0;
  for (let day = monthStart; day < monthEnd; day = addDaysToDateKey(day, 1)) {
    for (const interval of hours ?? []) {
      if (interval.weekday === weekdayFromDateKey(day)) {
        const start = localDateTimeToUtc(day, interval.start_time.slice(0, 5), business.timezone).getTime();
        const end = localDateTimeToUtc(day, interval.end_time.slice(0, 5), business.timezone).getTime();
        const absences = (timeOff ?? []).filter((absence) => (!absence.staff_id || absence.staff_id === interval.staff_id)
          && new Date(absence.starts_at).getTime() < end && new Date(absence.ends_at).getTime() > start)
          .map((absence) => [Math.max(start, new Date(absence.starts_at).getTime()), Math.min(end, new Date(absence.ends_at).getTime())] as const)
          .sort((a, b) => a[0] - b[0]);
        let unavailable = 0;
        let rangeStart = -1;
        let rangeEnd = -1;
        for (const [absenceStart, absenceEnd] of absences) {
          if (rangeStart < 0) { rangeStart = absenceStart; rangeEnd = absenceEnd; }
          else if (absenceStart <= rangeEnd) rangeEnd = Math.max(rangeEnd, absenceEnd);
          else { unavailable += rangeEnd - rangeStart; rangeStart = absenceStart; rangeEnd = absenceEnd; }
        }
        if (rangeStart >= 0) unavailable += rangeEnd - rangeStart;
        capacityMinutes += Math.max(0, (end - start - unavailable) / 60_000);
      }
    }
  }
  const bookedMinutes = activeAppointments.reduce((sum, appointment) => sum + Math.max(0, (new Date(appointment.ends_at).getTime() - new Date(appointment.starts_at).getTime()) / 60_000), 0);
  const occupancy = capacityMinutes ? Math.min(100, Math.round(bookedMinutes / capacityMinutes * 100)) : 0;

  const byStaff = (staff ?? []).map((person) => {
    const completedForStaff = completed.filter((appointment) => appointment.staff_id === person.id);
    return { ...person, count: completedForStaff.length, revenue: completedForStaff.reduce((sum, appointment) => sum + (serviceById.get(appointment.service_id)?.price_cents ?? 0), 0) };
  }).sort((a, b) => b.revenue - a.revenue);
  const byService = (services ?? []).map((service) => ({ ...service, count: activeAppointments.filter((appointment) => appointment.service_id === service.id).length }))
    .sort((a, b) => b.count - a.count).slice(0, 5);
  const maxServiceCount = Math.max(1, ...byService.map((service) => service.count));
  const monthName = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: business.timezone, month: "long", year: "numeric" }).format(now);

  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#20241f] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-6xl">
      <Link href="/dashboard" className="text-sm font-medium text-[#52624f]">← Kontrolna tabla</Link>
      <p className="mt-8 text-sm font-medium text-[#718a70]">{business.name} · {monthName}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em]">Statistika</h1>
      <p className="mt-2 text-sm text-[#737c71]">Prihod je procena prema završenim uslugama; aplikacija trenutno ne prati naplate.</p>
      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {[
          ["Popunjenost", `${occupancy}%`, `${Math.round(bookedMinutes)} od ${capacityMinutes} radnih minuta`],
          ["Procenjeni prihod", money(revenueCents), `${completed.length} završenih termina`],
          ["Najtraženija usluga", byService[0]?.name ?? "—", `${byService[0]?.count ?? 0} zakazivanja`],
          ["No-show stopa", `${noShowRate}%`, `${noShows.length} od ${completed.length + noShows.length} završenih/nepojavljivanja`],
        ].map(([label, value, detail]) => <article key={label} className="rounded-2xl border border-[#e9ece5] bg-white p-5"><p className="text-xs font-medium text-[#718a70]">{label}</p><p className="mt-2 text-2xl font-semibold">{value}</p><p className="mt-1 text-xs text-[#737c71]">{detail}</p></article>)}
      </div>
      <div className="mt-5 grid gap-5 lg:grid-cols-2">
        <section className="rounded-2xl border border-[#e9ece5] bg-white p-5 sm:p-6"><h2 className="font-semibold">Prihod po zaposlenom</h2><div className="mt-5 space-y-4">{byStaff.map((person) => <div key={person.id}><div className="flex justify-between gap-3 text-sm"><span>{person.name}</span><span className="font-semibold">{money(person.revenue)}</span></div><p className="mt-1 text-xs text-[#737c71]">{person.count} završenih termina</p></div>)}{!byStaff.length && <p className="text-sm text-[#737c71]">Nema aktivnih zaposlenih.</p>}</div></section>
        <section className="rounded-2xl border border-[#e9ece5] bg-white p-5 sm:p-6"><h2 className="font-semibold">Najpopularnije usluge</h2><div className="mt-5 space-y-4">{byService.map((service) => <div key={service.id}><div className="flex justify-between gap-3 text-sm"><span>{service.name}</span><span className="font-semibold">{service.count}</span></div><div className="mt-2 h-2 overflow-hidden rounded-full bg-[#edf1e9]"><div className="h-full rounded-full bg-[#6f9272]" style={{ width: `${service.count / maxServiceCount * 100}%` }} /></div></div>)}</div></section>
      </div>
    </div>
  </main>;
}
