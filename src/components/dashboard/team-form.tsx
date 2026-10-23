"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { inviteTeamMember, removeTeamMember, type TeamActionState } from "@/actions/team";

function SubmitButton() {
  const { pending } = useFormStatus();
  return <button disabled={pending} className="h-11 rounded-xl bg-[#365842] px-5 text-sm font-semibold text-white disabled:opacity-60">{pending ? "Šaljem…" : "Pozovi člana"}</button>;
}

export function TeamForm({ staff }: { staff: Array<{ id: string; name: string }> }) {
  const [state, action] = useActionState<TeamActionState, FormData>(inviteTeamMember, {});
  return <form action={action} className="grid gap-4 sm:grid-cols-3">
    <label className="text-sm font-medium text-[#38443a] sm:col-span-3">Email naloga<input name="email" type="email" required className="mt-2 h-11 w-full rounded-xl border border-[#e3e7df] px-3" placeholder="zaposleni@primer.rs" /></label>
    <label className="text-sm font-medium text-[#38443a]">Uloga<select name="role" required defaultValue="staff" className="mt-2 h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3"><option value="staff">Staff</option><option value="admin">Admin</option></select></label>
    <label className="text-sm font-medium text-[#38443a] sm:col-span-2">Povezani zaposleni (obavezno za staff)<select name="staffId" defaultValue="" className="mt-2 h-11 w-full rounded-xl border border-[#e3e7df] bg-white px-3"><option value="">Bez zaposlenog</option>{staff.map((person) => <option key={person.id} value={person.id}>{person.name}</option>)}</select></label>
    {state.error && <p role="alert" className="text-sm text-[#a34231] sm:col-span-3">{state.error}</p>}
    {state.message && <p role="status" className="text-sm text-[#45634b] sm:col-span-3">{state.message}</p>}
    <div className="sm:col-span-3"><SubmitButton /></div>
  </form>;
}

export function RemoveMemberButton({ userId }: { userId: string }) {
  return <form action={removeTeamMember}><input type="hidden" name="userId" value={userId} /><button className="text-xs font-semibold text-[#a34231]">Ukloni pristup</button></form>;
}
