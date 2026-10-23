import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck2,
  Check,
  Clock3,
  Menu,
  Scissors,
  ShieldCheck,
  Sparkles,
  UsersRound,
} from "lucide-react";

const benefits = [
  {
    icon: CalendarCheck2,
    title: "Raspored bez preklapanja",
    description:
      "Termini se proveravaju u trenutku zakazivanja, tako da svaki gost vidi samo dostupne opcije.",
  },
  {
    icon: UsersRound,
    title: "Tim na jednom mestu",
    description:
      "Poveži članove tima sa uslugama koje rade i prilagodi radno vreme svakom zaposlenom.",
  },
  {
    icon: Clock3,
    title: "Manje poruka, više vremena",
    description:
      "Podeli svoju stranicu za zakazivanje i prepusti gostima da sami izaberu uslugu i termin.",
  },
];

const weekDays = ["PON", "UTO", "SRE", "ČET", "PET"];
const bookingSteps = [
  {
    number: "01",
    label: "IZBOR",
    icon: UsersRound,
    title: "Klijent bira uslugu",
    description: "Na javnoj stranici bira uslugu, zaposlenog ili bilo koga iz tima, pa datum koji mu odgovara.",
    details: ["Usluga", "Zaposleni", "Datum"],
  },
  {
    number: "02",
    label: "PROVERA",
    icon: Clock3,
    title: "Termino nalazi slobodno vreme",
    description: "Proverava radno vreme, pauze, trajanje usluge, odsustva i već zauzete termine.",
    details: ["Radno vreme", "Pauze", "Bez preklapanja"],
  },
  {
    number: "03",
    label: "POTVRDA",
    icon: CalendarCheck2,
    title: "Termin stiže u kalendar",
    description: "Rezervacija se prikazuje u boji zaposlenog, a klijent dobija potvrdu i kalendar poziv.",
    details: ["10:30", "Šišanje", "Potvrđeno"],
  },
];

export default function Home() {
  return (
    <main className="min-h-screen overflow-hidden bg-[#fbfaf8] text-[#20241f]">
      <div className="pointer-events-none absolute inset-x-0 top-0 -z-0 h-[760px] bg-[radial-gradient(ellipse_at_70%_0%,rgba(188,211,174,0.30),transparent_55%)]" />

      <header className="relative z-10 mx-auto flex max-w-7xl items-center justify-between px-5 py-5 sm:px-8 lg:px-12">
        <Link href="/" aria-label="Termino početna" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-[#365842] text-white shadow-sm">
            <Scissors size={18} strokeWidth={2.2} />
          </span>
          <span className="text-xl font-semibold tracking-[-0.06em]">termino</span>
        </Link>

        <nav aria-label="Glavna navigacija" className="hidden items-center gap-8 text-sm text-[#697168] md:flex">
          <a className="transition hover:text-[#263c2c]" href="#mogucnosti">Mogućnosti</a>
          <a className="transition hover:text-[#263c2c]" href="#kako-radi">Kako radi</a>
        </nav>

        <div className="flex items-center gap-3">
          <Link className="hidden rounded-full px-4 py-2 text-sm font-medium text-[#344239] transition hover:bg-white/70 sm:inline-flex" href="/login">
            Prijava
          </Link>
          <Link className="inline-flex items-center gap-2 rounded-full bg-[#365842] px-4 py-2.5 text-sm font-medium text-white shadow-[0_5px_14px_rgba(54,88,66,0.16)] transition hover:bg-[#294a34]" href="/signup">
            Započni besplatno <ArrowRight size={15} />
          </Link>
          <button aria-label="Otvori meni" className="flex size-10 items-center justify-center rounded-full border border-[#e7e8e2] bg-white text-[#344239] md:hidden">
            <Menu size={18} />
          </button>
        </div>
      </header>

      <section className="relative z-10 mx-auto grid max-w-7xl items-center gap-14 px-5 pb-20 pt-14 sm:px-8 sm:pt-20 lg:grid-cols-[0.94fr_1.06fr] lg:gap-10 lg:px-12 lg:pb-28 lg:pt-24">
        <div className="max-w-xl">
          <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[#dce6d8] bg-white/75 px-3.5 py-2 text-xs font-medium text-[#45634b] shadow-sm">
            <Sparkles size={14} />
            <span>Jednostavno zakazivanje za tvoj biznis</span>
          </div>
          <h1 className="text-[clamp(3.2rem,7vw,5.8rem)] font-semibold leading-[0.99] tracking-[-0.075em] text-[#222820]">
            Tvoj posao.
            <br />
            Tvoj raspored.
            <br />
            <span className="font-serif font-normal italic tracking-[-0.065em] text-[#648568]">Pod kontrolom.</span>
          </h1>
          <p className="mt-7 max-w-lg text-base leading-7 text-[#697168] sm:text-lg sm:leading-8">
            Termino pomaže salonima i ordinacijama da organizuju tim, usluge i termine — a gostima da rezervišu kad njima odgovara.
          </p>
          <div className="mt-9 flex flex-col gap-3 sm:flex-row">
            <Link className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[#365842] px-6 text-sm font-medium text-white shadow-[0_7px_18px_rgba(54,88,66,0.18)] transition hover:-translate-y-0.5 hover:bg-[#294a34]" href="/signup">
              Napravi nalog <ArrowRight size={16} />
            </Link>
            <a className="inline-flex min-h-12 items-center justify-center rounded-full border border-[#e2e5dd] bg-white/70 px-6 text-sm font-medium text-[#3a453c] transition hover:bg-white" href="#kako-radi">
              Pogledaj kako radi
            </a>
          </div>
          <div className="mt-7 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-[#7d857c]">
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#648568]" /> Bez komplikovanog podešavanja</span>
            <span className="inline-flex items-center gap-1.5"><Check size={14} className="text-[#648568]" /> Napravljeno za male timove</span>
          </div>
        </div>

        {/* Prikaz je statičan primer kako će izgledati kalendar u kontrolnoj tabli. */}
        <div className="relative mx-auto w-full max-w-[620px] lg:ml-auto">
          <div className="absolute -right-5 -top-8 size-28 rounded-full bg-[#e2eadc] blur-2xl sm:-right-2" />
          <div className="absolute -bottom-8 -left-5 size-36 rounded-full bg-[#f0e7d7] blur-2xl" />
          <div className="relative rounded-[26px] border border-white bg-white/90 p-3 shadow-[0_28px_90px_rgba(53,66,50,0.12)] sm:rounded-[32px] sm:p-5">
            <div className="rounded-[20px] border border-[#eff0eb] bg-[#fff] p-4 sm:p-5">
              <div className="flex items-center justify-between border-b border-[#eff0eb] pb-4">
                <div>
                  <p className="text-xs font-medium text-[#8a9188]">PREGLED RASPOREDA</p>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight">Oktobar 2026.</h2>
                </div>
                <div className="flex items-center gap-2 rounded-full bg-[#f3f5f0] px-3 py-2 text-xs font-medium text-[#52624f]">
                  <span className="size-2 rounded-full bg-[#77a17a]" /> Ove nedelje
                </div>
              </div>

              <div className="mt-4 grid grid-cols-[42px_repeat(5,minmax(0,1fr))] gap-1.5 sm:gap-2">
                <div />
                {weekDays.map((day, index) => (
                  <div key={day} className={`rounded-xl py-2 text-center ${index === 2 ? "bg-[#365842] text-white" : "text-[#7e877c]"}`}>
                    <span className="block text-[9px] font-medium tracking-wide opacity-75">{day}</span>
                    <span className="mt-1 block text-sm font-semibold">{[19, 20, 21, 22, 23][index]}</span>
                  </div>
                ))}

                {["09:00", "10:00", "11:00", "12:00", "13:00"].map((time, row) => (
                  <div key={time} className="contents">
                    <div className="pt-2 text-[9px] font-medium text-[#a1a69e] sm:text-[10px]">{time}</div>
                    {weekDays.map((day, column) => {
                      const bookings: Record<string, { name: string; service: string; tone: string }> = {
                        "0-0": { name: "Milica P.", service: "Šišanje", tone: "bg-[#edf3e9] border-[#d6e4d2] text-[#4e6b4e]" },
                        "1-1": { name: "Ana J.", service: "Farbanje", tone: "bg-[#f6eee3] border-[#eadbc3] text-[#8b704c]" },
                        "2-0": { name: "Jelena M.", service: "Feniranje", tone: "bg-[#edf3e9] border-[#d6e4d2] text-[#4e6b4e]" },
                        "2-2": { name: "Sara L.", service: "Tretman lica", tone: "bg-[#f0ecf6] border-[#e1d8ee] text-[#786291]" },
                        "3-3": { name: "Mina R.", service: "Šišanje", tone: "bg-[#edf3e9] border-[#d6e4d2] text-[#4e6b4e]" },
                        "4-1": { name: "Tea K.", service: "Manikir", tone: "bg-[#f6eee3] border-[#eadbc3] text-[#8b704c]" },
                        "4-4": { name: "Lana S.", service: "Feniranje", tone: "bg-[#edf3e9] border-[#d6e4d2] text-[#4e6b4e]" },
                      };
                      const booking = row < 4 ? bookings[`${row}-${column}`] : undefined;

                      return (
                        <div key={`${day}-${time}`} className={`min-h-[48px] rounded-lg border p-1 sm:min-h-[52px] sm:p-1.5 ${booking ? booking.tone : "border-[#f0f1ed] bg-[#fcfcfb]"}`}>
                          {booking && <><span className="block truncate text-[9px] font-semibold sm:text-[10px]">{booking.name}</span><span className="mt-0.5 hidden truncate text-[9px] opacity-75 sm:block">{booking.service}</span></>}
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between rounded-xl bg-[#f7f8f5] px-3.5 py-3">
                <span className="text-xs text-[#747d72]">Danas imaš <strong className="text-[#344d37]">8 zakazivanja</strong></span>
                <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#648568]"><span className="size-1.5 rounded-full bg-[#77a17a]" /> Raspored ažuriran</span>
              </div>
            </div>
          </div>
          <div className="absolute -bottom-5 -left-3 flex items-center gap-3 rounded-2xl border border-white bg-white px-4 py-3 shadow-[0_12px_35px_rgba(53,66,50,0.12)] sm:-left-7 sm:bottom-8">
            <span className="flex size-9 items-center justify-center rounded-xl bg-[#edf3e9] text-[#527250]"><ShieldCheck size={18} /></span>
            <span><strong className="block text-xs font-semibold">Termin potvrđen</strong><span className="mt-0.5 block text-[10px] text-[#899087]">Bez duplih rezervacija</span></span>
          </div>
        </div>
      </section>

      <section id="mogucnosti" className="relative border-y border-[#edeee8] bg-white/70 px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#718a70]">Sve na jednom mestu</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Više pažnje za klijente.<br className="hidden sm:block" /> Manje vremena za organizaciju.</h2>
          </div>
          <div className="mt-12 grid gap-4 md:grid-cols-3">
            {benefits.map(({ icon: Icon, title, description }, index) => (
              <article key={title} className="rounded-2xl border border-[#eceee8] bg-[#fff] p-6 sm:p-7 dark:border-[#354238] dark:bg-[#202820]">
                <div className={`flex size-11 items-center justify-center rounded-[14px] ${index === 1 ? "bg-[#f6eee3] text-[#98784e] dark:bg-[#3a3327] dark:text-white" : "bg-[#edf3e9] text-[#557454] dark:bg-[#2b382d] dark:text-white"}`}><Icon size={20} strokeWidth={1.8} /></div>
                <h3 className="mt-5 text-base font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#747d72]">{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="kako-radi" className="scroll-mt-8 px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[#718a70]">Od rezervacije do rasporeda</p>
            <h2 className="mt-3 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Kako radi Termino?</h2>
            <p className="mt-4 text-sm leading-6 text-[#747d72] sm:text-base">Klijent sam bira termin, a ti odmah dobijaš uredan i proveren raspored.</p>
          </div>

          <div className="mt-10 grid gap-4 md:grid-cols-3">
            {bookingSteps.map(({ number, label, icon: Icon, title, description, details }) => (
              <article key={number} className="flex min-h-[280px] flex-col rounded-2xl border border-[#eceee8] bg-white p-6 shadow-[0_12px_36px_rgba(53,66,50,0.04)] sm:p-7">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold tracking-[0.16em] text-[#718a70]">{number} / {label}</span>
                  <span className="flex size-11 items-center justify-center rounded-xl bg-[#f7f8f5] text-[#365842]"><Icon size={20} strokeWidth={1.8} /></span>
                </div>
                <h3 className="mt-6 text-lg font-semibold tracking-tight">{title}</h3>
                <p className="mt-2 text-sm leading-6 text-[#747d72]">{description}</p>
                <div className="mt-auto flex flex-wrap gap-2 pt-6">
                  {details.map((detail, index) => (
                    <span key={detail} className={`rounded-full px-3 py-1.5 text-xs font-medium ${number === "03" && index === 2 ? "bg-[#365842] text-white" : "bg-[#f7f8f5] text-[#52624f]"}`}>
                      {detail}
                    </span>
                  ))}
                </div>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="px-5 py-16 sm:px-8 sm:py-20 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 rounded-[26px] bg-[#304b36] px-7 py-9 text-white sm:flex-row sm:items-center sm:px-10 sm:py-11">
          <div>
            <p className="text-xs font-medium uppercase tracking-[0.16em] text-[#c0d1b9]">Spremni za lakšu organizaciju?</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-[-0.04em] sm:text-3xl">Napravi prostor za ono što je važno.</h2>
          </div>
          <Link className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full bg-white px-5 text-sm font-semibold text-[#304b36] transition hover:bg-[#edf3e9]" href="/signup">
            Započni besplatno <ArrowRight size={16} />
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#edeee8] px-5 py-6 sm:px-8 lg:px-12">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 text-xs text-[#899087] sm:flex-row">
          <Link href="/" className="font-semibold tracking-[-0.04em] text-[#52624f]">termino</Link>
          <p>Jednostavno zakazivanje za salone i ordinacije.</p>
          <p>© Termino</p>
        </div>
      </footer>
    </main>
  );
}
