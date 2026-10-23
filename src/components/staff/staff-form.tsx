"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveStaff } from "@/actions/staff";
import type { FormState } from "@/actions/auth";

type ServiceOption = { id: string; name: string };
type StaffValues = { id: string; name: string; color: string; serviceIds: string[] };

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#365842] px-5 text-sm font-semibold text-white transition hover:bg-[#294a34] disabled:opacity-60">
      {pending ? "Čuvam…" : editing ? "Sačuvaj izmene" : "Dodaj zaposlenog"}
    </button>
  );
}

export function StaffForm({ services, staff, compact = false }: { services: ServiceOption[]; staff?: StaffValues; compact?: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveStaff, {});
  const editing = Boolean(staff?.id);

  return (
    <form action={formAction} className={compact ? "space-y-4" : "space-y-5"}>
      {staff?.id && <input type="hidden" name="staffId" value={staff.id} />}
      <label className="block space-y-2 text-sm font-medium text-[#38443a]">
        Ime zaposlenog
        <input name="name" required minLength={2} maxLength={100} defaultValue={staff?.name ?? ""} placeholder="npr. Milica Petrović" className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3.5 font-normal outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
      </label>

      <label className="flex items-center justify-between gap-4 text-sm font-medium text-[#38443a]">
        Boja u kalendaru
        <input name="color" type="color" defaultValue={staff?.color ?? "#6366f1"} aria-label="Boja zaposlenog" className="size-11 cursor-pointer rounded-xl border border-[#e3e7df] bg-white p-1.5" />
      </label>

      <fieldset className="space-y-2.5">
        <legend className="mb-2 text-sm font-medium text-[#38443a]">Usluge koje radi</legend>
        {services.length === 0 ? (
          <p className="rounded-xl bg-[#f7f8f5] p-3 text-xs leading-5 text-[#7b8379]">Nema usluga za povezivanje. Možeš ih prvo dodati u <a className="font-semibold text-[#45634b] underline underline-offset-2" href="/dashboard/services">Uslugama</a>.</p>
        ) : (
          <div className="flex flex-wrap gap-2 rounded-xl border border-[#e9ece5] p-3">
            {services.map((service) => <span key={service.id} className="contents"><input type="hidden" name="serviceIds" value={service.id} /><span className="rounded-full bg-[#f1f4ee] px-3 py-1.5 text-xs text-[#52624f]">{service.name}</span></span>)}
            <p className="w-full text-xs text-[#7b8379]">Svi zaposleni rade sve aktivne usluge.</p>
          </div>
        )}
      </fieldset>

      {state.error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-3.5 py-3 text-sm text-[#a34231]">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl bg-[#edf4ea] px-3.5 py-3 text-sm text-[#45634b]">{state.message}</p>}
      <SaveButton editing={editing} />
    </form>
  );
}
