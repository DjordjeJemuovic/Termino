"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { addDaysToDateKey } from "@/lib/scheduling/time";

export function CalendarShortcuts({ date, view, timezone }: { date: string; view: "day" | "week"; timezone: string }) {
  const router = useRouter();
  const [showHelp, setShowHelp] = useState(false);
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.altKey || event.ctrlKey || event.metaKey) return;
      const target = event.target as HTMLElement | null;
      if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
      const step = view === "week" ? 7 : 1;
      if (event.key.toLowerCase() === "t") router.push(`/dashboard/calendar?view=${view}&date=${new Intl.DateTimeFormat("sv-SE", { timeZone: timezone }).format(new Date())}`);
      else if (event.key === "ArrowLeft") router.push(`/dashboard/calendar?view=${view}&date=${addDaysToDateKey(date, -step)}`);
      else if (event.key === "ArrowRight") router.push(`/dashboard/calendar?view=${view}&date=${addDaysToDateKey(date, step)}`);
      else if (event.key.toLowerCase() === "w") router.push(`/dashboard/calendar?view=${view === "week" ? "day" : "week"}&date=${date}`);
      else if (event.key === "?") setShowHelp((current) => !current);
      else if (event.key === "Escape") setShowHelp(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [date, router, timezone, view]);

  return <>
    <button type="button" onClick={() => setShowHelp(true)} className="rounded-xl border border-[#e3e7df] bg-white px-3 py-2.5 text-xs font-medium text-[#52624f]" aria-label="Prikaži tastaturne prečice">? Prečice</button>
    {showHelp && <div className="fixed inset-0 z-50 grid place-items-center bg-black/40 p-4" onClick={() => setShowHelp(false)}>
      <section role="dialog" aria-modal="true" aria-labelledby="calendar-shortcuts-title" onClick={(event) => event.stopPropagation()} className="w-full max-w-sm rounded-2xl bg-white p-6 text-[#20241f] shadow-xl">
        <h2 id="calendar-shortcuts-title" className="text-lg font-semibold">Tastaturne prečice</h2>
        <dl className="mt-4 space-y-3 text-sm"><div className="flex justify-between"><dt>Prethodni period</dt><dd><kbd>←</kbd></dd></div><div className="flex justify-between"><dt>Sledeći period</dt><dd><kbd>→</kbd></dd></div><div className="flex justify-between"><dt>Danas</dt><dd><kbd>T</kbd></dd></div><div className="flex justify-between"><dt>Promeni dan/nedelju</dt><dd><kbd>W</kbd></dd></div><div className="flex justify-between"><dt>Otvori pomoć</dt><dd><kbd>?</kbd></dd></div></dl>
        <button type="button" onClick={() => setShowHelp(false)} className="mt-5 rounded-lg bg-[#365842] px-4 py-2 text-sm font-semibold text-white">Zatvori</button>
      </section>
    </div>}
  </>;
}
