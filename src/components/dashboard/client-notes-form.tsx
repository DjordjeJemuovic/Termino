"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { saveClientNotes } from "@/actions/clients";

function SaveNotesButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="mt-2 rounded-lg border border-[#e3e7df] px-3 py-2 text-xs font-semibold text-[#405243] disabled:opacity-60">{pending ? "Čuvam…" : "Sačuvaj belešku"}</button>;
}

export function ClientNotesForm({ clientId, notes }: { clientId: string; notes: string }) {
  const [state, action] = useActionState(saveClientNotes, {});
  return <form action={action} className="mt-4 border-t border-[#eef0eb] pt-4">
    <input type="hidden" name="clientId" value={clientId} />
    <label className="block text-xs font-semibold text-[#657160]">Beleške<textarea name="notes" maxLength={2000} defaultValue={notes} rows={3} className="mt-2 w-full resize-y rounded-xl border border-[#e3e7df] p-3 text-sm font-normal text-[#38443a]" placeholder="Važne napomene za sledeću posetu…" /></label>
    {state.error && <p role="alert" className="mt-2 text-xs text-[#a34231]">{state.error}</p>}
    {state.success && <p role="status" className="mt-2 text-xs text-[#45634b]">Beleška je sačuvana.</p>}
    <SaveNotesButton />
  </form>;
}
