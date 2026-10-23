# Booking sistem za salone i ordinacije

Radni naziv: **Termino** (promeni po želji).
Cilj: multi-tenant aplikacija gde svaki salon/ordinacija ima svoju javnu stranicu za zakazivanje i admin panel sa kalendarom.

## Stack

| Deo | Izbor |
|---|---|
| Framework | Next.js (App Router) + TypeScript |
| UI | Tailwind + shadcn/ui |
| Baza + Auth | Supabase (Postgres, Auth, RLS) |
| Validacija | Zod + React Hook Form |
| Datumi | date-fns + date-fns-tz |
| Kalendar | FullCalendar (resource timeline) ili custom |
| Server state | TanStack Query |
| Email | Resend (free tier) |
| ICS fajlovi | `ics` paket |
| Testovi | Vitest (unit), Playwright (1-2 e2e) |
| Hosting | Vercel free |

## Funkcionalnosti

### Faza 1: MVP (jezgro)
- Registracija/login vlasnika (Supabase Auth), kreiranje "business-a" sa slug-om [Done]
- Usluge: naziv, trajanje, buffer posle termina, cena [Done]
- Zaposleni: boja, aktivan/neaktivan; svi zaposleni rade sve aktivne usluge [Done]
- Radno vreme po zaposlenom, po danima, sa više intervala (pauza za ručak) [Done]
- **Algoritam slobodnih termina** (srce projekta, vidi dole) [Done]
- Javna stranica `/b/[slug]`: izbor usluge, radnika (ili "bilo ko"), datuma, termina, unos podataka [Done]
- Admin kalendar: dnevni/nedeljni prikaz, termini u boji radnika [Done]
- Sprečavanje duplog zakazivanja na nivou baze (exclusion constraint) [Done]

### Faza 2: Ono što razlikuje od CRUD-a
- Drag-and-drop pomeranje termina i resize trajanja, sa detekcijom konflikata [Done]
- Ručno dodavanje termina iz admina (telefonski poziv, walk-in) [Done]
- Odsustva i praznici (po radniku ili za ceo salon) [Done]
- Link za otkazivanje/pomeranje iz emaila (token, bez naloga klijenta) [Done]
- Pravila: minimalno vreme unapred, maks dana unapred, rok za otkazivanje [Done]
- Email potvrda + `.ics` prilog, podsetnik 24h ranije (Supabase cron / Vercel cron) [Done]
- Lista klijenata sa istorijom termina i beleškama [Done]
- Role: owner / admin / staff (staff vidi samo svoj kalendar) [Done]

### Faza 3: Polish i "wow"
- Statistika: popunjenost, prihod po radniku, najpopularnije usluge, no-show stopa [Done]
- Waitlist: ako je termin popunjen, klijent se upiše i dobije mejl kad se oslobodi [Done]
- Dark mode, mobilni prikaz, tastaturne prečice u kalendaru [Done]
- Embed widget (iframe/script tag) za ugradnju na sajt salona [Done]
- Demo režim: jedan klik popuni seed podacima [Done]
- i18n (sr/en) kroz javne, auth i administrativne stranice [Done]

## Algoritam slobodnih termina

Ulaz: `businessId, serviceId, staffId | "any", date`

1. Učitaj uslugu (`duration + buffer`) i radno vreme radnika za taj dan u timezone-u salona
2. Pretvori radne intervale u UTC raspon
3. Oduzmi: postojeće termine (pending/confirmed), odsustva radnika, odsustva salona
4. Preostale "rupe" podeli na slotove sa korakom `slot_step_minutes` (npr. 15 min)
5. Zadrži samo slotove gde cela usluga + buffer staje u rupu
6. Izbaci prošle slotove i one unutar `min_notice_minutes`
7. Za "bilo ko": spoji slotove svih radnika koji rade tu uslugu, pri zakazivanju dodeli onog sa najmanje termina tog dana

Ovo je **čista funkcija** (bez baze unutra): prima podatke, vraća slotove. Zato je lako testirati.

Testovi koje obavezno napiši (10-15):
- radno vreme sa pauzom
- usluga duža od rupe
- buffer između termina
- odsustvo usred dana
- prelazak letnje/zimske satnice (DST)
- min notice i max days ahead
- "bilo ko" raspodela

## Struktura projekta

```
termino/
├── src/
│   ├── app/
│   │   ├── (marketing)/page.tsx            # landing [Done]
│   │   ├── (auth)/login/ i signup/
│   │   ├── b/[slug]/                       # javno zakazivanje
│   │   │   ├── page.tsx
│   │   │   ├── booking-flow.tsx
│   │   │   └── manage/[token]/page.tsx     # otkazivanje/pomeranje
│   │   ├── dashboard/
│   │   │   ├── layout.tsx
│   │   │   ├── calendar/page.tsx
│   │   │   ├── clients/page.tsx
│   │   │   ├── services/page.tsx
│   │   │   ├── staff/page.tsx
│   │   │   ├── analytics/page.tsx
│   │   │   └── settings/page.tsx
│   │   └── api/
│   │       ├── slots/route.ts
│   │       └── cron/reminders/route.ts
│   ├── components/
│   │   ├── ui/                             # shadcn
│   │   ├── calendar/
│   │   ├── booking/
│   │   └── forms/
│   ├── lib/
│   │   ├── scheduling/
│   │   │   ├── slots.ts                    # čista logika
│   │   │   ├── slots.test.ts
│   │   │   ├── time.ts                     # timezone helperi
│   │   │   └── assign-staff.ts
│   │   ├── email/ (send.ts, templates/)
│   │   ├── ics.ts
│   │   └── validators/                     # Zod šeme
│   ├── actions/                            # server actions
│   │   ├── appointments.ts
│   │   ├── services.ts
│   │   └── staff.ts
│   ├── hooks/
│   └── types/database.ts                   # generisano iz Supabase-a
├── e2e/booking.spec.ts
├── .env.example
└── README.md
```

## Redosled gradnje

1. **Setup:** Next.js, Tailwind, shadcn, Supabase projekat, env varijable [Done]
2. **Baza:** Supabase baza je podešena [Done], tipove možeš generisati komandom supabase gen types typescript
3. **Auth + onboarding:** signup → kreiranje business-a → dashboard shell [Done]
4. **Usluge i zaposleni:** forme, liste, radno vreme editor [Done]
5. **`slots.ts` + testovi** (pre bilo kakvog UI-ja za zakazivanje) [Done]
6. **Javni booking flow** (4 koraka) + server action za kreiranje termina [Done]
7. **Admin kalendar:** prikaz [Done], zatim drag/drop i resize
8. **Email + ICS + link za otkazivanje**
9. **Odsustva, role, klijenti**
10. **Cron podsetnici, statistika**
11. **Seed, demo režim, README sa GIF-om, deploy**

## Važne odluke

- **Sva vremena u UTC u bazi** (`timestamptz`), pretvaranje u timezone salona samo na prikazu i pri računanju radnog vremena
- **Zaštita od duplog zakazivanja je u bazi** (exclusion constraint), ne samo u kodu. Ako dvoje klikne istovremeno, baza odbija drugog, a aplikacija pokazuje "termin je upravo zauzet, izaberi drugi"
- **Javno zakazivanje ide kroz server action sa service role ključem**, klijent nikad ne piše direktno u `appointments`
- **RLS na svim tabelama**, članovi vide samo svoj business

## Šta pokazati u README-u

- GIF: klijent zakazuje, admin vidi termin u kalendaru uživo
- Dijagram baze
- Objašnjenje slot algoritma i exclusion constraint-a
- Link na demo sa jednim klikom "popuni demo podacima"
- Sekcija "Šta bih sledeće dodao"
