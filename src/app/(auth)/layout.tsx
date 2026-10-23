import Link from "next/link";
import type { ReactNode } from "react";
import { Scissors } from "lucide-react";

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen flex-col bg-[#fbfaf8] px-5 py-6 sm:px-8">
      <Link href="/" className="mx-auto flex w-full max-w-6xl items-center gap-2.5">
        <span className="flex size-9 items-center justify-center rounded-xl bg-[#365842] text-white"><Scissors size={18} /></span>
        <span className="text-xl font-semibold tracking-[-0.06em]">termino</span>
      </Link>
      <div className="flex flex-1 items-center justify-center py-12">
        <div className="w-full max-w-[440px] rounded-[28px] border border-[#eceee8] bg-white p-7 shadow-[0_20px_70px_rgba(53,66,50,0.08)] sm:p-10">
          {children}
        </div>
      </div>
      <p className="text-center text-xs text-[#899087]">Termino · Jednostavno zakazivanje za tvoj biznis</p>
    </main>
  );
}
