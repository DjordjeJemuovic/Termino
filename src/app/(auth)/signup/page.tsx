import { AuthForm } from "@/components/auth/auth-form";

export default function SignupPage() {
  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718a70]">Počni besplatno</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em]">Napravi svoj nalog</h1>
      <p className="mt-2 text-sm leading-6 text-[#7b8379]">Prvo pravimo vlasnički nalog, a zatim podešavaš svoj salon ili ordinaciju.</p>
      <AuthForm mode="signup" />
    </>
  );
}
