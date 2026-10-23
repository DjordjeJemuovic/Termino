"use client";

import { createContext, useContext, useEffect, useMemo, useSyncExternalStore, type ReactNode } from "react";
import { translateDocument } from "./document-translation";

export type Locale = "sr" | "en";
const messages = {
  sr: {
    onlineBooking: "Online zakazivanje", bookYourVisit: "Zakaži svoj termin", bookingIntro: "Izaberi uslugu, osobu iz tima i vreme koje ti odgovara.",
    chooseService: "Izaberi uslugu", chooseStaff: "Izaberi zaposlenog", anyone: "Bilo ko", chooseDateTime: "Izaberi datum i vreme",
    date: "Datum", showSlots: "Prikaži termine", findSlots: "Tražim termine…", noSlots: "Nema slobodnih termina za izabrani dan.",
    joinWaitlist: "Prijavi se na listu čekanja", fullName: "Ime i prezime", email: "Email", phone: "Telefon", optional: "opciono",
    notifyWaitlist: "Prijavi me", waitlistSuccess: "Dodat/a si na listu čekanja. Javićemo ti ako se termin oslobodi.",
    yourDetails: "Tvoji podaci", confirmBooking: "Potvrdi zakazivanje", confirming: "Potvrđujem…", chooseDateService: "Izaberi uslugu i datum.",
    appointmentConfirmed: "Zakazivanje je potvrđeno", manageBooking: "Pomeri ili otkaži termin", backToPage: "Nazad na stranicu",
    simpleBooking: "Jednostavno zakazivanje", busyDescription: "Izaberi uslugu i slobodan termin. Potvrda se čuva odmah, a zauzeti termini se ne mogu rezervisati dva puta.",
    yourSelection: "Tvoj izbor", calendar: "Kalendar", services: "Usluge", staff: "Zaposleni", clients: "Klijenti", analytics: "Statistika",
    dashboard: "Kontrolna tabla", welcomeTo: "u", fillDemo: "Popuni demo podatke", fillingDemo: "Popunjavam...", welcome: "Dobro došao", staffIntro: "Prikazan ti je raspored termina koji su dodeljeni tvom profilu.", ownerIntro: "Upravljaj rasporedom, klijentima i timom na jednom mestu.",
    calendarDesc: "Pregledaj dnevni i nedeljni raspored termina.", servicesDesc: "Dodaj usluge, trajanje i cenu.", staffDesc: "Podesi tim i radno vreme.", team: "Članovi i uloge", teamDesc: "Pozovi admina ili poveži staff nalog.", clientsDesc: "Pregledaj istoriju termina i beleške.", analyticsDesc: "Popunjenost, prihod i najtraženije usluge.", embed: "Embed widget", embedDesc: "Dodaj online zakazivanje na sajt salona.", waitlist: "Lista čekanja", waitlistDesc: "Pregledaj prijave za oslobođene termine.", publicAddress: "Javna adresa", demo: "Demo režim", demoDescription: "Popuni usluge, zaposlene, klijente i termine primerima.", signOut: "Odjavi se",
  },
  en: {
    onlineBooking: "Online booking", bookYourVisit: "Book an appointment", bookingIntro: "Choose a service, team member, and a time that works for you.",
    chooseService: "Choose a service", chooseStaff: "Choose a team member", anyone: "Anyone", chooseDateTime: "Choose date and time",
    date: "Date", showSlots: "Show available times", findSlots: "Looking for times…", noSlots: "No available times on this date.",
    joinWaitlist: "Join the waitlist", fullName: "Full name", email: "Email", phone: "Phone", optional: "optional",
    notifyWaitlist: "Join waitlist", waitlistSuccess: "You are on the waitlist. We will email you if a time becomes available.",
    yourDetails: "Your details", confirmBooking: "Confirm booking", confirming: "Confirming…", chooseDateService: "Choose a service and date.",
    appointmentConfirmed: "Booking confirmed", manageBooking: "Reschedule or cancel", backToPage: "Back to business page",
    simpleBooking: "Easy online booking", busyDescription: "Choose a service and an available time. Your booking is confirmed immediately, and busy times cannot be booked twice.",
    yourSelection: "Your selection", calendar: "Calendar", services: "Services", staff: "Team", clients: "Clients", analytics: "Analytics",
    dashboard: "Dashboard", welcome: "Welcome", welcomeTo: "to", staffIntro: "Here is the schedule assigned to your staff profile.", ownerIntro: "Manage your schedule, clients, and team in one place.",
    calendarDesc: "View your daily and weekly appointment schedule.", servicesDesc: "Add services, durations, and prices.", staffDesc: "Manage your team and working hours.", team: "Team access", teamDesc: "Invite admins or link a staff account.", clientsDesc: "View appointment history and notes.", analyticsDesc: "Occupancy, revenue, and popular services.", embed: "Booking widget", embedDesc: "Add online booking to your business website.", waitlist: "Waitlist", waitlistDesc: "View requests for newly available times.", publicAddress: "Public page", demo: "Demo mode", demoDescription: "Fill the app with sample services, staff, clients, and bookings.", fillDemo: "Fill with demo data", fillingDemo: "Adding demo data?", signOut: "Sign out",
  },
} as const;
type MessageKey = keyof typeof messages.sr;
const LocaleContext = createContext<{ locale: Locale; setLocale: (locale: Locale) => void; t: (key: MessageKey) => string } | null>(null);

function subscribeLocale(callback: () => void) {
  window.addEventListener("termino-locale-change", callback);
  window.addEventListener("storage", callback);
  return () => { window.removeEventListener("termino-locale-change", callback); window.removeEventListener("storage", callback); };
}
function getLocaleSnapshot(): Locale { return window.localStorage.getItem("termino-locale") === "en" ? "en" : "sr"; }
function saveLocale(locale: Locale) {
  window.localStorage.setItem("termino-locale", locale);
  window.dispatchEvent(new Event("termino-locale-change"));
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const locale: Locale = useSyncExternalStore<Locale>(subscribeLocale, getLocaleSnapshot, () => "sr" as Locale);
  useEffect(() => {
    document.documentElement.lang = locale === "sr" ? "sr" : "en";
    return translateDocument(locale);
  }, [locale]);
  const value = useMemo(() => ({ locale, setLocale: saveLocale, t: (key: MessageKey) => messages[locale][key] }), [locale]);
  return <LocaleContext.Provider value={value}>{children}</LocaleContext.Provider>;
}

export function useLocale() {
  const context = useContext(LocaleContext);
  if (!context) throw new Error("useLocale mora da se koristi unutar LocaleProvider.");
  return context;
}
