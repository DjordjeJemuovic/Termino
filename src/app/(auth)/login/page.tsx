import { AuthForm } from "@/components/auth/auth-form";

export default function LoginPage() {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718a70]">Dobro došao nazad</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em]">Prijavi se na Termino</h1>
      <p className="mt-2 text-sm leading-6 text-[#7b8379]">Nastavi da organizuješ svoj raspored i tim.</p>
      <AuthForm mode="login" />
    </>
  );
}
