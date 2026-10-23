"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import { CalendarDays, Check, Clock3, Scissors, UsersRound } from "lucide-react";
import { createPublicBooking, type BookingFormState } from "@/actions/bookings";
import { joinWaitlist, type WaitlistState } from "@/actions/waitlist";
import { useLocale } from "@/lib/i18n/locale-provider";
import type { PublicBusiness, PublicService, PublicStaff } from "@/lib/scheduling/supabase";

type Slot = { startsAt: string; serviceEndsAt: string; blockedUntil: string; staffId: string; availableStaffIds: string[] };

function formatPrice(priceCents: number, currency: string, locale: "sr" | "en") {
  return new Intl.NumberFormat(locale === "en" ? "en-US" : "sr-RS", { style: "currency", currency, maximumFractionDigits: 0 }).format(priceCents / 100);
}

export function BookingFlow({ business, services, staff, initialSelection }: { business: PublicBusiness; services: PublicService[]; staff: PublicStaff[]; initialSelection?: { service?: string; staff?: string; date?: string } }) {
  const { locale, t } = useLocale();
  const presetStaff = initialSelection?.staff;
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone }).format(new Date());
  const [serviceId, setServiceId] = useState(() => services.some((service) => service.id === initialSelection?.service) ? initialSelection!.service! : "");
  const [staffId, setStaffId] = useState(() => presetStaff === "any" || staff.some((person) => person.id === presetStaff) ? presetStaff ?? "any" : "any");
  const [date, setDate] = useState(() => /^\d{4}-\d{2}-\d{2}$/.test(initialSelection?.date ?? "") ? initialSelection!.date! : today);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotError, setSlotError] = useState("");
  const [state, formAction] = useActionState<BookingFormState, FormData>(createPublicBooking, {});
  const [waitlistState, waitlistAction] = useActionState<WaitlistState, FormData>(joinWaitlist, {});
  const selectedService = services.find((service) => service.id === serviceId);
  const eligibleStaff = staff.filter((person) => !serviceId || person.serviceIds.includes(serviceId));

  async function loadSlots() {
    if (!serviceId || !date) {
      setSlotError(t("chooseDateService"));
      return;
    }

    setLoadingSlots(true);
    setSlotError("");
    setSelectedSlot(null);
    try {
      const params = new URLSearchParams({ slug: business.slug, serviceId, date, staffId });
      const response = await fetch(`/api/slots?${params.toString()}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Termini nisu mogli da se učitaju.");
      setSlots(result.slots as Slot[]);
      if (!result.slots.length) setSlotError(t("noSlots"));
    } catch (error) {
      setSlotError(error instanceof Error ? error.message : "Termini nisu mogli da se učitaju.");
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }

  function changeService(nextServiceId: string) {
    setServiceId(nextServiceId);
    if (!staff.find((person) => person.id === staffId)?.serviceIds.includes(nextServiceId)) setStaffId("any");
    setSlots([]);
    setSelectedSlot(null);
  }

  const intlLocale = locale === "en" ? "en-US" : "sr-Latn-RS";
  const timeFormatter = new Intl.DateTimeFormat(intlLocale, {
    timeZone: business.timezone,
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

  if (state.success) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-5 py-12 text-[#20241f]">
        <section className="w-full max-w-lg rounded-[28px] border border-[#eceee8] bg-white p-8 text-center shadow-[0_20px_70px_rgba(53,66,50,0.08)] sm:p-10">
          <span className="mx-auto flex size-14 items-center justify-center rounded-2xl bg-[#edf4ea] text-[#557454]"><Check size={26} /></span>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight">Zakazivanje je potvrđeno</h1>
          <p className="mt-2 text-sm leading-6 text-[#737c71]">{state.message}</p>
          {state.managePath && <Link href={state.managePath} className="mt-4 inline-flex h-11 items-center justify-center rounded-xl border border-[#dce4d8] px-5 text-sm font-semibold text-[#405a42] hover:bg-[#f3f7f1]">Pomeri ili otkaži termin</Link>}
          <Link href={`/b/${business.slug}`} className="mt-7 inline-flex h-11 items-center justify-center rounded-xl bg-[#365842] px-5 text-sm font-semibold text-white hover:bg-[#294a34]">{t("backToPage")}</Link>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#fbfaf8] px-4 py-8 text-[#20241f] sm:px-6 sm:py-12">
      <div className="mx-auto max-w-5xl">
        <header className="mb-8 flex items-center justify-between">
          <Link href="/" className="flex items-center gap-2.5 text-lg font-semibold tracking-[-0.05em]"><span className="flex size-9 items-center justify-center rounded-xl bg-[#365842] text-white"><Scissors size={18} /></span>termino</Link>
          <span className="rounded-full border border-[#e4e8df] bg-white px-3 py-1.5 text-xs font-medium text-[#657160]">{t("onlineBooking")}</span>
        </header>

        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
          <section className="rounded-[26px] border border-[#eceee8] bg-white p-5 shadow-[0_14px_50px_rgba(53,66,50,0.06)] sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718a70]">{business.name}</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Zakaži svoj termin</h1>
            <p className="mt-2 text-sm leading-6 text-[#7b8379]">{t("bookingIntro")}</p>

            <div className="mt-8 space-y-8">
              <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-[#edf4ea] text-xs text-[#557454]">1</span> {t("chooseService")}</h2>
                {services.length === 0 ? <p className="mt-3 text-sm text-[#7b8379]">Trenutno nema dostupnih usluga za zakazivanje.</p> : <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  {services.map((service) => (
                    <button key={service.id} type="button" onClick={() => changeService(service.id)} className={`rounded-xl border p-3.5 text-left transition ${serviceId === service.id ? "border-[#729274] bg-[#f3f7f1] ring-2 ring-[#729274]/10" : "border-[#e9ece5] hover:border-[#cbd8c8]"}`}>
                      <span className="block text-sm font-semibold">{service.name}</span>
                      <span className="mt-1 flex items-center justify-between gap-2 text-xs text-[#7b8379]"><span>{service.duration_minutes} min{service.buffer_minutes ? ` + ${service.buffer_minutes} min buffer` : ""}</span><span className="font-semibold text-[#52624f]">{formatPrice(service.price_cents, service.currency, locale)}</span></span>
                    </button>
                  ))}
                </div>}
              </section>

              {selectedService && <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-[#edf4ea] text-xs text-[#557454]">2</span> {t("chooseStaff")}</h2>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => { setStaffId("any"); setSlots([]); setSelectedSlot(null); }} className={`rounded-full border px-4 py-2 text-sm transition ${staffId === "any" ? "border-[#729274] bg-[#f3f7f1] font-semibold text-[#405a42]" : "border-[#e9ece5] text-[#667064] hover:bg-[#f7f8f5]"}`}>{t("anyone")}</button>
                  {eligibleStaff.map((person) => <button key={person.id} type="button" onClick={() => { setStaffId(person.id); setSlots([]); setSelectedSlot(null); }} className={`inline-flex items-center gap-2 rounded-full border px-4 py-2 text-sm transition ${staffId === person.id ? "border-[#729274] bg-[#f3f7f1] font-semibold text-[#405a42]" : "border-[#e9ece5] text-[#667064] hover:bg-[#f7f8f5]"}`}><span className="size-2 rounded-full" style={{ backgroundColor: person.color }} />{person.name}</button>)}
                </div>
              </section>}

              {selectedService && <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-[#edf4ea] text-xs text-[#557454]">3</span> {t("chooseDateTime")}</h2>
                <div className="mt-3 flex flex-col gap-3 sm:flex-row sm:items-end">
                  <label className="block flex-1 space-y-2 text-xs font-medium text-[#657160]">{t("date")}
                    <input type="date" value={date} min={new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone }).format(new Date())} onChange={(event) => { setDate(event.target.value); setSlots([]); setSelectedSlot(null); }} className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3 text-sm text-[#38443a] outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
                  </label>
                  <button type="button" onClick={loadSlots} disabled={loadingSlots} className="inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-[#365842] px-4 text-sm font-semibold text-white transition hover:bg-[#294a34] disabled:opacity-60"><CalendarDays size={16} />{loadingSlots ? "Tražim termine…" : "Prikaži termine"}</button>
                </div>
                {slots.length > 0 && <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {slots.map((slot) => <button key={slot.startsAt} type="button" onClick={() => setSelectedSlot(slot)} className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-lg border text-sm transition ${selectedSlot?.startsAt === slot.startsAt ? "border-[#729274] bg-[#edf4ea] font-semibold text-[#405a42]" : "border-[#e9ece5] text-[#586456] hover:border-[#cbd8c8]"}`}><Clock3 size={13} />{timeFormatter.format(new Date(slot.startsAt))}</button>)}
                </div>}
                {slotError && <p role="status" className="mt-3 text-sm text-[#7b8379]">{slotError}</p>}
                {slotError === t("noSlots") && slots.length === 0 && !loadingSlots && !waitlistState.success && <form action={waitlistAction} className="mt-4 grid gap-3 rounded-xl border border-[#e9ece5] bg-[#f8faf6] p-4 sm:grid-cols-2">
                  <p className="text-sm font-semibold sm:col-span-2">Prijavi se na listu čekanja</p>
                  <input type="hidden" name="slug" value={business.slug} /><input type="hidden" name="serviceId" value={serviceId} /><input type="hidden" name="staffId" value={staffId} /><input type="hidden" name="date" value={date} /><input type="text" name="website" tabIndex={-1} autoComplete="off" aria-hidden="true" className="hidden" />
                  <label className="text-xs font-medium">{t("fullName")}<input required name="name" autoComplete="name" className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm" /></label>
                  <label className="text-xs font-medium">{t("email")}<input required type="email" name="email" autoComplete="email" className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm" /></label>
                  <label className="text-xs font-medium sm:col-span-2">{t("phone")} ({t("optional")})<input name="phone" autoComplete="tel" className="mt-1 h-10 w-full rounded-lg border bg-white px-3 text-sm" /></label>
                  {waitlistState.error && <p role="alert" className="text-sm text-red-700 sm:col-span-2">{waitlistState.error}</p>}
                  <button className="rounded-lg bg-[#365842] px-4 py-2.5 text-sm font-semibold text-white sm:col-span-2">{t("notifyWaitlist")}</button>
                </form>}
                {waitlistState.success && <p role="status" className="mt-4 rounded-xl bg-[#edf4ea] p-4 text-sm text-[#405a42]">{t("waitlistSuccess")}</p>}
              </section>}

              {selectedSlot && selectedService && <section>
                <h2 className="flex items-center gap-2 text-sm font-semibold"><span className="flex size-6 items-center justify-center rounded-full bg-[#edf4ea] text-xs text-[#557454]">4</span> {t("yourDetails")}</h2>
                <form action={formAction} className="mt-3 grid gap-3 sm:grid-cols-2">
                  <input type="hidden" name="slug" value={business.slug} />
                  <input type="hidden" name="serviceId" value={selectedService.id} />
                  <input type="hidden" name="staffId" value={staffId} />
                  <input type="hidden" name="date" value={date} />
                  <input type="hidden" name="startsAt" value={selectedSlot.startsAt} />
                  <label className="space-y-1.5 text-xs font-medium text-[#657160]">Ime i prezime<input name="customerName" required minLength={2} maxLength={120} autoComplete="name" className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3 text-sm font-normal text-[#38443a] outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" placeholder="Tvoje ime" /></label>
                  <label className="space-y-1.5 text-xs font-medium text-[#657160]">Email<input name="customerEmail" type="email" required autoComplete="email" className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3 text-sm font-normal text-[#38443a] outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" placeholder="ime@primer.rs" /></label>
                  <label className="space-y-1.5 text-xs font-medium text-[#657160] sm:col-span-2">Telefon <span className="font-normal">(opciono)</span><input name="customerPhone" type="tel" autoComplete="tel" className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3 text-sm font-normal text-[#38443a] outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" placeholder="06x xxx xxxx" /></label>
                  {state.error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#a34231] sm:col-span-2">{state.error}</p>}
                  <div className="sm:col-span-2"><SubmitButton /></div>
                </form>
              </section>}
            </div>
          </section>

          <aside className="rounded-[22px] border border-[#eceee8] bg-white p-5 sm:p-6">
            <span className="flex size-10 items-center justify-center rounded-xl bg-[#edf3e9] text-[#557454]"><UsersRound size={19} /></span>
            <h2 className="mt-4 font-semibold">{t("simpleBooking")}</h2>
            <p className="mt-1 text-sm leading-6 text-[#7b8379]">Izaberi uslugu i slobodan termin. Potvrda se čuva odmah, a zauzeti termini se ne mogu rezervisati dva puta.</p>
            {selectedSlot && selectedService && <div className="mt-5 rounded-xl bg-[#f7f8f5] p-4 text-sm">
              <p className="font-semibold">{t("yourSelection")}</p>
              <p className="mt-2 text-[#667064]">{selectedService.name}</p>
              <p className="mt-1 text-[#667064]">{new Intl.DateTimeFormat(intlLocale, { timeZone: business.timezone, dateStyle: "medium" }).format(new Date(selectedSlot.startsAt))} · {timeFormatter.format(new Date(selectedSlot.startsAt))}</p>
              <p className="mt-1 text-[#667064]">{formatPrice(selectedService.price_cents, selectedService.currency, locale)}</p>
              {staff.find((person) => person.id === selectedSlot.staffId) && <p className="mt-1 text-[#667064]">{staff.find((person) => person.id === selectedSlot.staffId)?.name}</p>}
            </div>}
          </aside>
        </div>
        <footer className="mt-8 text-center text-xs text-[#899087]">{t("onlineBooking")} · {business.name}</footer>
      </div>
    </main>
  );
}

function SubmitButton() {
  const { pending } = useFormStatus();
  const { t } = useLocale();
  return <button disabled={pending} className="inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#365842] px-5 text-sm font-semibold text-white transition hover:bg-[#294a34] disabled:cursor-wait disabled:opacity-60">{pending ? "Potvrđujem…" : t("confirmBooking")}</button>;
}
