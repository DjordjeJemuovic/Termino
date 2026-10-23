"use client";

import { useEffect, useSyncExternalStore } from "react";
import { Moon, Sun } from "lucide-react";
import { useLocale } from "@/lib/i18n/locale-provider";

function Controls() {
  const dark = useSyncExternalStore(subscribeTheme, getThemeSnapshot, () => false);
  const { locale, setLocale } = useLocale();
  useEffect(() => {
    document.documentElement.classList.toggle("dark", dark);
  }, [dark]);
  useEffect(() => {
    if (window.parent !== window) document.documentElement.classList.add("is-embed");
    return () => document.documentElement.classList.remove("is-embed");
  }, []);
  return <aside className="fixed bottom-4 right-4 z-[60] flex items-center gap-1 rounded-full border border-[#dfe5dc] bg-white/95 p-1 text-[#405243] shadow-lg backdrop-blur dark:border-[#536156] dark:bg-[#1e2620] dark:text-white" aria-label="Podešavanja prikaza">
    <button type="button" onClick={() => setLocale(locale === "sr" ? "en" : "sr")} className="min-h-9 rounded-full px-3 text-xs font-bold transition hover:bg-[#edf3e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648568] dark:hover:bg-[#303b32] dark:focus-visible:ring-[#a8c3a4]" aria-label={locale === "sr" ? "Switch to English" : "Prebaci na srpski"}>{locale.toUpperCase()}</button>
    <button type="button" onClick={() => setTheme(!dark)} className="flex size-9 items-center justify-center rounded-full border border-transparent text-[#344239] transition hover:bg-[#edf3e9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#648568] dark:border-[#536156] dark:bg-[#303b32] dark:text-white dark:hover:bg-[#3b4a3d] dark:focus-visible:ring-[#a8c3a4]" aria-label={dark ? "Isključi tamnu temu" : "Uključi tamnu temu"}>{dark ? <Sun size={18} strokeWidth={2.3} /> : <Moon size={18} strokeWidth={2.3} />}</button>
  </aside>;
}

function getThemeSnapshot() {
  const saved = window.localStorage.getItem("termino-theme");
  return saved ? saved === "dark" : window.matchMedia("(prefers-color-scheme: dark)").matches;
}
function subscribeTheme(callback: () => void) {
  window.addEventListener("termino-theme-change", callback);
  return () => window.removeEventListener("termino-theme-change", callback);
}
function setTheme(dark: boolean) {
  window.localStorage.setItem("termino-theme", dark ? "dark" : "light");
  window.dispatchEvent(new Event("termino-theme-change"));
}

export function AppearanceControls() {
  return <Controls />;
}
