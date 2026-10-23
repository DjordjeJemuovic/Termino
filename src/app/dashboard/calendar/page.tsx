import { Suspense } from "react";
import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { addDaysToDateKey, assertValidDateKey, localDateTimeToUtc, weekdayFromDateKey } from "@/lib/scheduling/time";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { signOut } from "@/actions/auth";
import { AdminAppointmentForm } from "@/components/dashboard/admin-forms";
import { CalendarDropColumn, InteractiveAppointment } from "@/components/dashboard/calendar-interactions";
import { CalendarShortcuts } from "@/components/dashboard/calendar-shortcuts";
import { AppointmentStatus } from "@/components/ui/appointment-status";

const timelineStartHour = 0;
const timelineEndHour = 24;
const pixelsPerMinute = 1;

function dateLabel(dateKey: string, timeZone: string, options: Intl.DateTimeFormatOptions) {
  const localNoon = localDateTimeToUtc(dateKey, "12:00", timeZone);
  return new Intl.DateTimeFormat("sr-Latn-RS", { timeZone, ...options }).format(localNoon);
}

type CalendarPageProps = { searchParams: Promise<{ date?: string; view?: string }> };

export default function CalendarPage(props: CalendarPageProps) {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#f7f8f5] p-8 text-sm text-[#667064]" role="status">Učitavam kalendar…</div>}>
      <CalendarContent searchParams={props.searchParams} />
    </Suspense>
  );
}

async function CalendarContent({ searchParams }: CalendarPageProps) {
  // The calendar depends on the current time, so resolve it at request time.
  await connection();
  const query = await searchParams;
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

  const { data: business } = await supabase
    .from("businesses")
    .select("id, name, timezone")
    .eq("id", membership.business_id)
    .single();
  if (!business) redirect("/onboarding");

  const isStaffMember = membership.role === "staff";
  const { data: ownStaff } = isStaffMember
    ? await createSupabaseAdminClient().from("staff").select("id, name, color, active").eq("business_id", business.id).eq("user_id", user.id).maybeSingle()
    : { data: null };

  const view = query.view === "week" ? "week" : "day";
  let selectedDate = query.date ?? new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone }).format(new Date());
  try {
    assertValidDateKey(selectedDate);
  } catch {
    selectedDate = new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone }).format(new Date());
  }

  const firstDate = view === "week"
    ? addDaysToDateKey(selectedDate, -weekdayFromDateKey(selectedDate))
    : selectedDate;
  const dateCount = view === "week" ? 7 : 1;
  const dates = Array.from({ length: dateCount }, (_, index) => addDaysToDateKey(firstDate, index));
  const rangeStart = localDateTimeToUtc(firstDate, "00:00", business.timezone);
  const rangeEnd = localDateTimeToUtc(addDaysToDateKey(firstDate, dateCount), "00:00", business.timezone);

  let appointmentsQuery = supabase.from("appointments").select("id, staff_id, service_id, client_id, starts_at, ends_at, status")
    .eq("business_id", business.id)
    .lt("starts_at", rangeEnd.toISOString())
    .gt("ends_at", rangeStart.toISOString())
    .in("status", ["pending", "confirmed", "completed", "no_show"])
    .order("starts_at");
  if (isStaffMember) appointmentsQuery = appointmentsQuery.eq("staff_id", ownStaff?.id ?? "00000000-0000-0000-0000-000000000000");

  const [
    { data: appointments, error: appointmentsError },
    { data: staff, error: staffError },
    { data: services },
  ] = await Promise.all([
    appointmentsQuery,
    isStaffMember
      ? Promise.resolve({ data: ownStaff ? [ownStaff] : [], error: null })
      : supabase.from("staff").select("id, name, color, active").eq("business_id", business.id).order("sort_order").order("name"),
    // Formi za ručno zakazivanje trebaju sve aktivne usluge, čak i kad
    // trenutno izabrani dan još nema nijedan termin.
    supabase.from("services").select("id, name, duration_minutes").eq("business_id", business.id).eq("active", true).order("sort_order").order("name"),
  ]);
  const clientIds = [...new Set((appointments ?? []).map((appointment) => appointment.client_id))];
  const [{ data: clients }] = await Promise.all([
    clientIds.length ? supabase.from("clients").select("id, full_name").in("id", clientIds) : Promise.resolve({ data: [] }),
  ]);

  const staffById = new Map((staff ?? []).map((person) => [person.id, person]));
  const serviceById = new Map((services ?? []).map((service) => [service.id, service]));
  const clientById = new Map((clients ?? []).map((client) => [client.id, client]));
  const eventsByDate = new Map(dates.map((date) => [date, [] as Array<{
    id: string;
    title: string;
    client: string;
    startLabel: string;
    endLabel: string;
    color: string;
    top: number;
    height: number;
    startsAt: string;
    endsAt: string;
    status: string;
  }>]));

  for (const appointment of appointments ?? []) {
    const staffMember = staffById.get(appointment.staff_id);
    const service = serviceById.get(appointment.service_id);
    const client = clientById.get(appointment.client_id);
    if (!staffMember || !service) continue;

    const localDate = new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone }).format(new Date(appointment.starts_at));
    const column = eventsByDate.get(localDate);
    if (!column) continue;
    const startParts = new Intl.DateTimeFormat("en-GB", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(appointment.starts_at)).split(":").map(Number);
    const endParts = new Intl.DateTimeFormat("en-GB", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(appointment.ends_at)).split(":").map(Number);
    const startMinute = startParts[0] * 60 + startParts[1];
    const endMinute = endParts[0] * 60 + endParts[1];
    const height = Math.max(30, (endMinute > startMinute ? endMinute - startMinute : 30) * pixelsPerMinute);
    const startLabel = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(appointment.starts_at));
    const endLabel = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(appointment.ends_at));

    column.push({
      id: appointment.id,
      title: service.name,
      client: client?.full_name ?? "Klijent",
      startLabel,
      endLabel,
      color: staffMember.color,
      top: Math.max(0, startMinute - timelineStartHour * 60),
      height,
      startsAt: appointment.starts_at,
      endsAt: appointment.ends_at,
      status: appointment.status,
    });
  }

  const offset = view === "week" ? 7 : 1;
  const previousDate = addDaysToDateKey(selectedDate, -offset);
  const nextDate = addDaysToDateKey(selectedDate, offset);
  const rangeLabel = view === "day"
    ? dateLabel(selectedDate, business.timezone, { dateStyle: "full" })
    : `${dateLabel(firstDate, business.timezone, { day: "numeric", month: "short" })} – ${dateLabel(dates[6], business.timezone, { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#20241f]">
      <header className="border-b border-[#e9ece5] bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-5 py-4 sm:px-8">
          <div className="flex items-center gap-4">
            <Link href="/dashboard" className="text-sm font-medium text-[#52624f] hover:text-[#304b36]">← Kontrolna tabla</Link>
            <span className="hidden h-5 border-l border-[#e9ece5] sm:block" />
            <span className="hidden text-sm text-[#737c71] sm:block">{business.name}</span>
          </div>
          <div className="flex items-center gap-4 text-sm text-[#737c71]">
            <span className="hidden sm:inline">{user.email}</span>
            <form action={signOut}><button className="rounded-full border border-[#e3e7df] px-4 py-2 font-medium text-[#405243] hover:bg-[#f7f8f5]">Odjavi se</button></form>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1600px] px-4 py-7 sm:px-8 sm:py-10">
        <div className="flex flex-col justify-between gap-5 xl:flex-row xl:items-end">
          <div>
            <p className="text-sm font-medium text-[#718a70]">Raspored</p>
            <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em]">Kalendar</h1>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link href={`/dashboard/calendar?view=${view}&date=${previousDate}`} aria-label="Prethodni period" className="flex size-10 items-center justify-center rounded-xl border border-[#e3e7df] bg-white text-lg text-[#52624f] hover:bg-[#f7f8f5]">‹</Link>
            <Link href={`/dashboard/calendar?view=${view}&date=${new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone }).format(new Date())}`} className="inline-flex h-10 items-center rounded-xl border border-[#e3e7df] bg-white px-3 text-xs font-medium text-[#52624f] hover:bg-[#f7f8f5]">Danas</Link>
            <Link href={`/dashboard/calendar?view=${view}&date=${nextDate}`} aria-label="Sledeći period" className="flex size-10 items-center justify-center rounded-xl border border-[#e3e7df] bg-white text-lg text-[#52624f] hover:bg-[#f7f8f5]">›</Link>
            <h2 className="min-w-48 px-2 text-sm font-semibold capitalize">{rangeLabel}</h2>
            <Link href={`/dashboard/calendar?view=day&date=${selectedDate}`} className={`inline-flex h-10 items-center rounded-xl px-3 text-xs font-semibold ${view === "day" ? "bg-[#365842] text-white" : "border border-[#e3e7df] bg-white text-[#52624f]"}`}>Dan</Link>
            <Link href={`/dashboard/calendar?view=week&date=${selectedDate}`} className={`inline-flex h-10 items-center rounded-xl px-3 text-xs font-semibold ${view === "week" ? "bg-[#365842] text-white" : "border border-[#e3e7df] bg-white text-[#52624f]"}`}>Nedelja</Link>
            <CalendarShortcuts date={selectedDate} view={view} timezone={business.timezone} />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-x-4 gap-y-2">
          {(staff ?? []).map((person) => <span key={person.id} className="inline-flex items-center gap-2 text-xs text-[#667064]"><span className="size-2.5 rounded-full" style={{ backgroundColor: person.color }} />{person.name}{!person.active && " (neaktivan)"}</span>)}
        </div>

        {!isStaffMember && <div className="mt-5 flex flex-wrap gap-2">
          <Link href="/dashboard/time-off" className="rounded-xl border border-[#e3e7df] bg-white px-4 py-2.5 text-sm font-medium text-[#405243]">Odsustva i praznici</Link>
          <Link href="/dashboard/settings" className="rounded-xl border border-[#e3e7df] bg-white px-4 py-2.5 text-sm font-medium text-[#405243]">Pravila zakazivanja</Link>
          <a href="#rucno-zakazivanje" className="rounded-xl bg-[#365842] px-4 py-2.5 text-sm font-semibold text-white">Ručno dodaj termin</a>
        </div>}

        {!isStaffMember && <details id="rucno-zakazivanje" className="mt-4 rounded-2xl border border-[#e5e9e1] bg-white p-5">
          <summary className="cursor-pointer text-sm font-semibold">Unesi telefonski zakazan termin ili walk-in posetu</summary>
          <div className="mt-5"><AdminAppointmentForm staff={(staff ?? []).filter((person) => person.active)} services={(services ?? []).filter((service) => service.duration_minutes > 0)} /></div>
        </details>}

        {isStaffMember && !ownStaff && <p role="alert" className="mt-5 rounded-xl bg-[#fff4e8] p-4 text-sm text-[#8c5b22]">Nalog još nije povezan sa profilom zaposlenog. Obrati se vlasniku salona.</p>}
        {(appointmentsError || staffError) && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#a34231]">Kalendar nije mogao da učita sve podatke.</p>}

        <div className="mt-5 space-y-3 md:hidden">
          {dates.map((date) => <section key={date} className="rounded-2xl border border-[#e5e9e1] bg-white p-4">
            <h2 className="mb-3 text-sm font-semibold capitalize">{dateLabel(date, business.timezone, { weekday: "long", day: "numeric", month: "long" })}</h2>
            {(eventsByDate.get(date) ?? []).length ? <ul className="space-y-2">{(eventsByDate.get(date) ?? []).map((event) => <li key={event.id} className="rounded-xl border-l-4 bg-[#f7f8f5] p-3" style={{ borderLeftColor: event.color }}>
              <p className="text-sm font-semibold">{event.startLabel}–{event.endLabel} · {event.client}</p><p className="mt-1 text-xs text-[#667064]">{event.title} · <AppointmentStatus status={event.status} /></p>
            </li>)}</ul> : <p className="text-xs text-[#899087]">Nema termina.</p>}
          </section>)}
        </div>

        <div className="mt-5 hidden overflow-x-auto rounded-2xl border border-[#e5e9e1] bg-white shadow-[0_10px_40px_rgba(53,66,50,0.04)] md:block">
          <div className="min-w-[760px]" style={{ display: "grid", gridTemplateColumns: `64px repeat(${dateCount}, minmax(140px, 1fr))` }}>
            <div className="sticky left-0 z-20 border-b border-[#e9ece5] bg-white" />
            {dates.map((date) => <div key={date} className="sticky top-0 z-10 border-b border-l border-[#e9ece5] bg-white px-3 py-3 text-center">
              <span className="block text-[10px] font-semibold uppercase tracking-wider text-[#849080]">{dateLabel(date, business.timezone, { weekday: "short" })}</span>
              <span className="mt-1 block text-sm font-semibold">{dateLabel(date, business.timezone, { day: "numeric", month: "short" })}</span>
            </div>)}

            <div className="relative bg-white" style={{ height: (timelineEndHour - timelineStartHour) * 60 * pixelsPerMinute }}>
              {Array.from({ length: timelineEndHour - timelineStartHour }, (_, index) => <span key={index} className="absolute right-2 -translate-y-1/2 text-[10px] text-[#929a90]" style={{ top: index * 60 * pixelsPerMinute }}>{String(index + timelineStartHour).padStart(2, "0")}:00</span>)}
            </div>

            {dates.map((date) => <CalendarDropColumn key={date} date={date} timezone={business.timezone}>
              {Array.from({ length: timelineEndHour - timelineStartHour + 1 }, (_, index) => <div key={`grid-${index}`} className="absolute inset-x-0 border-t border-[#eef0eb]" style={{ top: index * 60 * pixelsPerMinute }} />)}
              {(eventsByDate.get(date) ?? []).map((event) => <InteractiveAppointment key={event.id} event={event} canEdit={!isStaffMember} />)}
              {(eventsByDate.get(date)?.length ?? 0) === 0 && !appointmentsError && <p className="absolute left-2 right-2 top-4 text-center text-[10px] text-[#b0b6ac]">Nema termina</p>}
            </CalendarDropColumn>)}
          </div>
        </div>
        <p className="mt-3 text-xs text-[#899087]">Vremena su prikazana u zoni {business.timezone}.</p>
      </div>
    </main>
  );
}
