"use client";

import Link from "next/link";
import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { createBusiness, signIn, signUp, type FormState } from "@/actions/auth";

function SubmitButton({ label, pendingLabel }: { label: string; pendingLabel: string }) {
  const { pending } = useFormStatus();
  return (
    <button disabled={pending} className="mt-2 inline-flex h-12 w-full items-center justify-center rounded-xl bg-[#365842] px-5 text-sm font-semibold text-white transition hover:bg-[#294a34] disabled:cursor-wait disabled:opacity-70">
      {pending ? pendingLabel : label}
    </button>
  );
}

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? signIn : signUp;
  const [state, formAction] = useActionState<FormState, FormData>(action, {});
  const isSignup = mode === "signup";

  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block space-y-2 text-sm font-medium text-[#38443a]">
        Email adresa
        <input name="email" type="email" autoComplete="email" required className="h-12 w-full rounded-xl border border-[#e3e7df] bg-white px-4 font-normal outline-none transition placeholder:text-[#a2a99f] focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" placeholder="ime@primer.rs" />
      </label>
      <label className="block space-y-2 text-sm font-medium text-[#38443a]">
        Lozinka
        <input name="password" type="password" autoComplete={isSignup ? "new-password" : "current-password"} minLength={8} required className="h-12 w-full rounded-xl border border-[#e3e7df] bg-white px-4 font-normal outline-none transition placeholder:text-[#a2a99f] focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" placeholder="Najmanje 8 karaktera" />
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#a34231]">{state.error}</p>}
      {state.message && <p role="status" className="rounded-xl bg-[#edf4ea] px-4 py-3 text-sm leading-6 text-[#45634b]">{state.message}</p>}
      <SubmitButton label={isSignup ? "Napravi nalog" : "Prijavi se"} pendingLabel={isSignup ? "Pravim nalog…" : "Prijavljujem…"} />
      <p className="pt-1 text-center text-sm text-[#7b8379]">
        {isSignup ? "Već imaš nalog? " : "Još nemaš nalog? "}
        <Link className="font-semibold text-[#45634b] hover:underline" href={isSignup ? "/login" : "/signup"}>{isSignup ? "Prijavi se" : "Registruj se"}</Link>
      </p>
    </form>
  );
}

export function BusinessForm() {
  const [state, formAction] = useActionState<FormState, FormData>(createBusiness, {});
  return (
    <form action={formAction} className="mt-8 space-y-5">
      <label className="block space-y-2 text-sm font-medium text-[#38443a]">
        Naziv salona ili ordinacije
        <input name="name" required minLength={2} maxLength={100} className="h-12 w-full rounded-xl border border-[#e3e7df] bg-white px-4 font-normal outline-none focus:border-[#779078] focus:ring-4 focus:ring-[#779078]/10" placeholder="npr. Studio Lipa" />
      </label>
      <label className="block space-y-2 text-sm font-medium text-[#38443a]">
        Adresa za zakazivanje
        <div className="flex h-12 items-center rounded-xl border border-[#e3e7df] bg-white pl-4 focus-within:border-[#779078] focus-within:ring-4 focus-within:ring-[#779078]/10">
          <span className="text-sm font-normal text-[#98a095]">termino.rs/b/</span>
          <input name="slug" minLength={3} maxLength={40} pattern="[a-zA-Z0-9-]+" className="h-full min-w-0 flex-1 rounded-r-xl bg-transparent px-1 pr-4 text-sm font-normal outline-none" placeholder="studio-lipa" />
        </div>
        <span className="block text-xs font-normal leading-5 text-[#899087]">Možeš uneti svoju adresu ili ostaviti prazno da je napravimo iz naziva.</span>
      </label>
      {state.error && <p role="alert" className="rounded-xl bg-[#fff0ed] px-4 py-3 text-sm text-[#a34231]">{state.error}</p>}
      <SubmitButton label="Napravi poslovni prostor" pendingLabel="Pravim prostor…" />
    </form>
  );
}
