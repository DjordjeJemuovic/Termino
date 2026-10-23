"use client";

import { useState } from "react";
import { useActionState } from "react";
import { managePublicAppointment, type ManageAppointmentState } from "@/actions/bookings";

type Slot = { startsAt: string; blockedUntil: string };

export function ManageAppointment({
  token, slug, serviceId, staffId, appointmentId, timezone, initialDate, canManage, status,
}: {
  token: string; slug: string; serviceId: string; staffId: string; appointmentId: string;
  timezone: string; initialDate: string; canManage: boolean; status: string;
}) {
  const [date, setDate] = useState(initialDate);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [selected, setSelected] = useState("");
  const [busy, setBusy] = useState(false);
  const [loadError, setLoadError] = useState("");
  const [cancelState, cancelAction, cancelling] = useActionState<ManageAppointmentState, FormData>(managePublicAppointment, {});
  const [moveState, moveAction, moving] = useActionState<ManageAppointmentState, FormData>(managePublicAppointment, {});
  const time = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" });

  async function loadSlots() {
    setBusy(true); setLoadError(""); setSelected("");
    try {
      const query = new URLSearchParams({ slug, serviceId, date, staffId, excludeAppointmentId: appointmentId });
      const response = await fetch(`/api/slots?${query}`, { cache: "no-store" });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error ?? "Termini nisu mogli da se učitaju.");
      setSlots(result.slots as Slot[]);
      if (!result.slots.length) setLoadError("Nema slobodnih termina za ovaj datum.");
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "Termini nisu mogli da se učitaju.");
    } finally { setBusy(false); }
  }

  if (cancelState.success) return <p role="status" className="rounded-xl bg-[#edf4ea] p-4 text-sm text-[#45634b]">{cancelState.message}</p>;
  return <div className="space-y-5">
    {!canManage && <p className="rounded-xl bg-[#fff4e8] p-4 text-sm text-[#8c5b22]">{status === "cancelled" ? "Ovaj termin je već otkazan." : status === "completed" ? "Ovaj termin je završen." : status === "no_show" ? "Termin je označen kao nedolazak." : "Rok za samostalno pomeranje ili otkazivanje je istekao. Kontaktiraj salon."}</p>}
    {canManage && <>
      <form action={cancelAction} className="space-y-3">
        <input type="hidden" name="token" value={token} /><input type="hidden" name="intent" value="cancel" /><input type="hidden" name="startsAt" value="" />
        {cancelState.error && <p role="alert" className="text-sm text-[#a34231]">{cancelState.error}</p>}
        <button disabled={cancelling} className="h-11 rounded-xl border border-[#ecd5d0] px-4 text-sm font-semibold text-[#a34231] disabled:opacity-60">{cancelling ? "Otkazujem…" : "Otkaži termin"}</button>
      </form>
      <section className="border-t border-[#eceee8] pt-5">
        <h2 className="font-semibold">Promeni termin</h2>
        <div className="mt-3 flex gap-2"><input type="date" value={date} min={new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date())} onChange={(event) => { setDate(event.target.value); setSlots([]); setSelected(""); }} className="h-11 flex-1 rounded-xl border border-[#e3e7df] px-3 text-sm" />
          <button type="button" onClick={loadSlots} disabled={busy} className="h-11 rounded-xl bg-[#365842] px-4 text-sm font-semibold text-white disabled:opacity-60">{busy ? "Tražim…" : "Traži"}</button></div>
        {slots.length > 0 && <div className="mt-3 grid grid-cols-4 gap-2">{slots.map((slot) => <button type="button" key={slot.startsAt} onClick={() => setSelected(slot.startsAt)} className={`rounded-lg border px-2 py-2 text-sm ${selected === slot.startsAt ? "border-[#729274] bg-[#edf4ea] font-semibold" : "border-[#e9ece5]"}`}>{time.format(new Date(slot.startsAt))}</button>)}</div>}
        {loadError && <p role="status" className="mt-3 text-sm text-[#737c71]">{loadError}</p>}
        <form action={moveAction} className="mt-4 space-y-3">
          <input type="hidden" name="token" value={token} /><input type="hidden" name="intent" value="reschedule" /><input type="hidden" name="startsAt" value={selected} />
          {moveState.error && <p role="alert" className="text-sm text-[#a34231]">{moveState.error}</p>}
          {moveState.success && <p role="status" className="text-sm text-[#45634b]">{moveState.message}</p>}
          <button disabled={!selected || moving} className="h-11 rounded-xl bg-[#365842] px-4 text-sm font-semibold text-white disabled:opacity-50">{moving ? "Pomeram…" : "Potvrdi novi termin"}</button>
        </form>
      </section>
    </>}
  </div>;
}
