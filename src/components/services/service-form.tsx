"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveService } from "@/actions/services";
import type { FormState } from "@/actions/auth";

type ServiceValues = {
  id?: string;
  name?: string;
  duration_minutes?: number;
  buffer_minutes?: number;
  price_cents?: number;
};

function SaveButton({ editing }: { editing: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="inline-flex h-11 items-center justify-center rounded-xl bg-[#365842] px-5 text-sm font-semibold text-white transition hover:bg-[#294a34] disabled:opacity-60">
      {pending ? "Čuvam…" : editing ? "Sačuvaj izmene" : "Dodaj uslugu"}
    </button>
  );
}

export function ServiceForm({ service, compact = false }: { service?: ServiceValues; compact?: boolean }) {
  const [state, formAction] = useActionState<FormState, FormData>(saveService, {});
  const editing = Boolean(service?.id);

  return (
    <form action={formAction} className={compact ? "space-y-4" : "grid gap-4 sm:grid-cols-2"}>
      {service?.id && <input type="hidden" name="serviceId" value={service.id} />}
      <label className="block space-y-2 text-sm font-medium text-[#38443a] sm:col-span-2">
        Naziv usluge
        <input name="name" required minLength={2} maxLength={100} defaultValue={service?.name ?? ""} placeholder="npr. Šišanje i feniranje" className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3.5 font-normal outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
      </label>
      <label className="block space-y-2 text-sm font-medium text-[#38443a]">
        Trajanje
        <span className="relative block">
          <input name="duration" type="number" min={5} max={600} step={5} required defaultValue={service?.duration_minutes ?? 30} className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3.5 pr-14 font-normal outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
          <span className="pointer-events-none absolute right-3.5 top-3 text-xs font-normal text-[#899087]">min</span>
        </span>
      </label>
      <label className="block space-y-2 text-sm font-medium text-[#38443a]">
        Buffer posle termina
        <span className="relative block">
          <input name="buffer" type="number" min={0} max={120} step={5} required defaultValue={service?.buffer_minutes ?? 0} className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3.5 pr-14 font-normal outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
          <span className="pointer-events-none absolute right-3.5 top-3 text-xs font-normal text-[#899087]">min</span>
        </span>
      </label>
      <label className="block space-y-2 text-sm font-medium text-[#38443a] sm:col-span-2">
        Cena
        <span className="relative block">
          <input name="price" type="number" min={0} max={1000000} step="0.01" required defaultValue={service ? (service.price_cents ?? 0) / 100 : ""} placeholder="0" className="h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3.5 pr-14 font-normal outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" />
          <span className="pointer-events-none absolute right-3.5 top-3 text-xs font-normal text-[#899087]">RSD</span>
        </span>
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-3.5 py-3 text-sm text-[#a34231] sm:col-span-2">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl bg-[#edf4ea] px-3.5 py-3 text-sm text-[#45634b] sm:col-span-2">{state.message}</p>}
      <div className="sm:col-span-2"><SaveButton editing={editing} /></div>
    </form>
  );
}
