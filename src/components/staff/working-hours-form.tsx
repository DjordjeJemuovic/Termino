"use client";

import { useState } from "react";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { Plus, Trash2 } from "lucide-react";
import { saveWorkingHours } from "@/actions/working-hours";
import type { FormState } from "@/actions/auth";

const weekdays = ["Ponedeljak", "Utorak", "Sreda", "Četvrtak", "Petak", "Subota", "Nedelja"];
type Interval = { id: string; start: string; end: string };

function SaveButton() {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#365842] px-5 text-sm font-semibold text-white transition hover:bg-[#294a34] disabled:opacity-60">
      {pending ? "Čuvam raspored…" : "Sačuvaj radno vreme"}
    </button>
  );
}

export function WorkingHoursForm({ staffId, initialIntervals }: { staffId: string; initialIntervals: Array<{ weekday: number; start_time: string; end_time: string }> }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveWorkingHours, {});
  const [schedule, setSchedule] = useState<Interval[][]>(() => weekdays.map((_, weekday) =>
    initialIntervals
      .filter((interval) => interval.weekday === weekday)
      .map((interval, index) => ({
        id: `${weekday}-${index}`,
        start: interval.start_time.slice(0, 5),
        end: interval.end_time.slice(0, 5),
      })),
  ));

  function addInterval(weekday: number) {
    setSchedule((current) => current.map((intervals, day) => day === weekday
      ? [...intervals, { id: `${weekday}-${crypto.randomUUID()}`, start: "09:00", end: "17:00" }]
      : intervals));
  }

  function removeInterval(weekday: number, intervalId: string) {
    setSchedule((current) => current.map((intervals, day) => day === weekday
      ? intervals.filter((interval) => interval.id !== intervalId)
      : intervals));
  }

  function changeInterval(weekday: number, intervalId: string, field: "start" | "end", value: string) {
    setSchedule((current) => current.map((intervals, day) => day === weekday
      ? intervals.map((interval) => interval.id === intervalId ? { ...interval, [field]: value } : interval)
      : intervals));
  }

  return (
    <form action={formAction} className="space-y-5">
      <input type="hidden" name="staffId" value={staffId} />
      <p className="rounded-xl bg-[#f7f8f5] px-4 py-3 text-xs leading-5 text-[#737c71]">Vremena su lokalna za salon. Više intervala u istom danu može da predstavi pauzu, na primer 09:00–12:00 i 13:00–17:00.</p>

      <div className="space-y-3">
        {weekdays.map((weekdayName, weekday) => (
          <section key={weekdayName} className="rounded-xl border border-[#e9ece5] bg-white p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-sm font-semibold">{weekdayName}</h2>
              <button type="button" onClick={() => addInterval(weekday)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-xs font-semibold text-[#557454] transition hover:bg-[#edf4ea]"><Plus size={14} /> Dodaj interval</button>
            </div>
            {schedule[weekday].length === 0 ? (
              <p className="mt-2 text-xs text-[#929a90]">Zatvoreno</p>
            ) : (
              <div className="mt-3 space-y-2">
                {schedule[weekday].map((interval, index) => (
                  <div key={interval.id} className="flex items-end gap-2">
                    <label className="min-w-0 flex-1 space-y-1 text-[11px] font-medium text-[#7b8379]">
                      {index === 0 ? "Od" : "Pauza — od"}
                      <input type="time" name={`day_${weekday}_start`} required value={interval.start} onChange={(event) => changeInterval(weekday, interval.id, "start", event.target.value)} className="h-10 w-full rounded-lg border border-[#e3e7df] bg-white px-2 text-sm text-[#38443a] outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
                    </label>
                    <label className="min-w-0 flex-1 space-y-1 text-[11px] font-medium text-[#7b8379]">
                      Do
                      <input type="time" name={`day_${weekday}_end`} required value={interval.end} onChange={(event) => changeInterval(weekday, interval.id, "end", event.target.value)} className="h-10 w-full rounded-lg border border-[#e3e7df] bg-white px-2 text-sm text-[#38443a] outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
                    </label>
                    <button type="button" onClick={() => removeInterval(weekday, interval.id)} aria-label={`Ukloni interval za ${weekdayName}`} className="mb-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg text-[#9a7770] transition hover:bg-[#fff0ed] hover:text-[#a34231]"><Trash2 size={15} /></button>
                  </div>
                ))}
              </div>
            )}
          </section>
        ))}
      </div>

      {state.error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#a34231]">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl bg-[#edf4ea] px-4 py-3 text-sm text-[#45634b]">{state.message}</p>}
      <SaveButton />
    </form>
  );
}
