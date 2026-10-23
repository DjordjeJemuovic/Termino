"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createAdminAppointment, saveBusinessRules, type AdminActionState } from "@/actions/admin-appointments";
import { createTimeOff } from "@/actions/time-off";

function SaveButton({ label }: { label: string }) {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-10 rounded-xl bg-[#365842] px-4 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Čuvam…" : label}</button>;
}

function FormFeedback({ state }: { state: AdminActionState }) {
  if (!state.error && !state.message) return null;
  return <p role={state.error ? "alert" : "status"} className={`text-sm ${state.error ? "text-[#a34231]" : "text-[#45634b]"}`}>{state.error ?? state.message}</p>;
}

export function AdminAppointmentForm({ staff, services }: { staff: Array<{ id: string; name: string }>; services: Array<{ id: string; name: string; duration_minutes: number }> }) {
  const [state, action] = useActionState(createAdminAppointment, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-medium text-[#657160]">Klijent<input name="name" required minLength={2} maxLength={120} className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Email (opciono)<input name="email" type="email" className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Telefon<input name="phone" type="tel" className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Usluga<select name="serviceId" required onChange={(event) => { const duration = services.find((item) => item.id === event.target.value)?.duration_minutes; const input = event.currentTarget.form?.elements.namedItem("duration"); if (input instanceof HTMLInputElement && duration) input.value = String(duration); }} className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] bg-white px-3 text-sm"><option value="">Izaberi uslugu</option>{services.map((service) => <option key={service.id} value={service.id}>{service.name}</option>)}</select></label>
    <label className="text-xs font-medium text-[#657160]">Zaposleni<select name="staffId" required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] bg-white px-3 text-sm"><option value="">Izaberi zaposlenog</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <label className="text-xs font-medium text-[#657160]">Trajanje (min)<input name="duration" type="number" min={5} max={600} step={5} defaultValue={30} required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Datum i vreme<input name="date" type="date" required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Početak<input name="time" type="time" required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160] sm:col-span-2">Napomena<input name="notes" maxLength={500} className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <FormFeedback state={state} /><SaveButton label="Dodaj termin" />
  </form>;
}

export function TimeOffForm({ staff }: { staff: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState(createTimeOff, {});
  return <form action={action} className="grid gap-3 sm:grid-cols-2">
    <label className="text-xs font-medium text-[#657160] sm:col-span-2">Na koga se odnosi?<select name="staffId" className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] bg-white px-3 text-sm"><option value="all">Ceo salon / praznik</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    <label className="text-xs font-medium text-[#657160]">Od datuma<input name="startDate" type="date" required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Od vremena<input name="startTime" type="time" defaultValue="09:00" required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Do datuma<input name="endDate" type="date" required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160]">Do vremena<input name="endTime" type="time" defaultValue="17:00" required className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <label className="text-xs font-medium text-[#657160] sm:col-span-2">Razlog<input name="reason" maxLength={160} placeholder="Godišnji odmor, praznik…" className="mt-1 h-10 w-full rounded-lg border border-[#e3e7df] px-3 text-sm" /></label>
    <FormFeedback state={state} /><SaveButton label="Dodaj odsustvo" />
  </form>;
}

export function BusinessRulesForm({ rules }: { rules: { min_notice_minutes: number; max_days_ahead: number; cancel_window_hours: number } }) {
  const [state, action] = useActionState(saveBusinessRules, {});
  return <form action={action} className="grid gap-4 sm:grid-cols-3">
    <label className="text-sm font-medium text-[#38443a]">Minimalno unapred (min)<input name="minNotice" type="number" min={0} max={525600} required defaultValue={rules.min_notice_minutes} className="mt-2 h-11 w-full rounded-xl border border-[#e3e7df] px-3" /></label>
    <label className="text-sm font-medium text-[#38443a]">Najviše dana unapred<input name="maxDaysAhead" type="number" min={1} max={365} required defaultValue={rules.max_days_ahead} className="mt-2 h-11 w-full rounded-xl border border-[#e3e7df] px-3" /></label>
    <label className="text-sm font-medium text-[#38443a]">Rok za otkazivanje (h)<input name="cancelWindow" type="number" min={0} max={8760} required defaultValue={rules.cancel_window_hours} className="mt-2 h-11 w-full rounded-xl border border-[#e3e7df] px-3" /></label>
    <FormFeedback state={state} /><div><SaveButton label="Sačuvaj pravila" /></div>
  </form>;
}
