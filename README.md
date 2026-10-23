# Termino

**Termino** is a multi-tenant appointment booking and scheduling platform for salons, clinics, and other service businesses. Each business gets a public booking page and a private dashboard for managing services, staff, availability, appointments, and clients.

The application is built with Next.js and TypeScript, with Supabase providing authentication and PostgreSQL storage. The interface supports Serbian and English, light and dark themes, and desktop and mobile layouts.

## Project at a glance

- **Public booking:** customers choose a service, a specific employee or “any available”, a date and time, then provide their contact details.
- **Business dashboard:** manage the calendar, services, staff, working hours, time off, clients, team access, and booking rules.
- **Reliable scheduling:** calculate availability in the business time zone and use a database constraint to prevent overlapping appointments.
- **Customer communication:** send booking confirmations and reminders, attach calendar files, and provide secure links for managing appointments.
- **Product features:** analytics, a waitlist, an embeddable booking widget, demo data, keyboard shortcuts, dark mode, and localization.

## Development phases

### Phase 1 — Booking foundations

The first phase established the core booking product:

- Owner sign-up and login with Supabase Auth, followed by business setup with a public slug.
- Service management, including duration, post-appointment buffer, and price.
- Staff profiles with calendar colors and active/inactive status. Staff are automatically linked to the business's services.
- Weekly working hours per employee, including multiple intervals in a day for breaks.
- A public booking page at `/b/[slug]` and an admin calendar with daily and weekly views.
- A time-zone-aware availability algorithm and database-level protection against double booking.

### Phase 2 — Day-to-day operations

The second phase added the workflows a business needs to manage real appointments:

- Optimistic drag-and-drop rescheduling and appointment resizing, with conflict detection.
- Manual appointment entry for phone bookings and walk-ins.
- Employee and business-wide time off and holidays.
- Customer links to cancel or reschedule without creating an account.
- Booking rules for minimum advance notice, maximum booking horizon, and cancellation deadlines.
- Confirmation emails with `.ics` calendar attachments and scheduled reminders roughly 24 hours before an appointment.
- Client history and notes, plus `owner`, `admin`, and `staff` roles. Staff accounts are restricted to their own calendar.

### Phase 3 — Polish and integrations

The final planned phase rounded out the product experience:

- Analytics for occupancy, estimated revenue, popular services, and no-show rate.
- A waitlist that can notify the earliest matching customer when availability opens.
- Dark mode, responsive layouts, and calendar keyboard shortcuts.
- An embeddable booking page at `/embed/[slug]` and an embed setup page in the dashboard.
- One-click demo data from the dashboard.
- Serbian and English localization across public booking, authentication, and dashboard pages.

## How availability is calculated

Availability is calculated for a business, service, employee (or any employee), and local calendar date. The scheduling code combines:

1. The service duration and its post-appointment buffer.
2. The employee's working intervals for that weekday, including breaks between intervals.
3. Existing pending or confirmed appointments and employee or business time off.
4. The configured slot step, minimum advance notice, and maximum booking horizon.
5. The business time zone, converting local working hours to UTC for storage and conflict checks.

A slot is returned only when the full service duration and buffer fit inside an available interval. When the customer chooses **any available**, eligible employees' slots are combined and an employee is assigned during booking. The database exclusion constraint remains the final guard against two concurrent bookings claiming overlapping time.

The core scheduling logic lives in `src/lib/scheduling/slots.ts`; time-zone helpers are in `src/lib/scheduling/time.ts`.

## Technology

- [Next.js](https://nextjs.org/) App Router, React, and TypeScript
- [Supabase](https://supabase.com/) Auth and PostgreSQL
- Tailwind CSS
- Zod and React Hook Form for form validation and handling
- `date-fns` and `date-fns-tz` for date and time-zone operations
- Resend for transactional email delivery
- Vitest for unit tests
- Vercel Cron for scheduled reminders

## Getting started

### Requirements

- Node.js and npm
- A Supabase project configured with the database schema expected by the application

### Install and configure

1. Install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env.local` and fill in the values for your Supabase project and local application URL.

3. Start the development server:

   ```bash
   npm run dev
   ```

4. Open [http://localhost:3000](http://localhost:3000), create an owner account, and complete business setup. You can also use the dashboard's demo data action to populate a business for exploration.

The database must be set up in Supabase before the application can use it. Keep database credentials and `.env.local` private; never commit secret keys or expose the Supabase service role key in browser code.

### Environment variables

| Variable | Purpose |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase client key used by the application |
| `SUPABASE_SERVICE_ROLE_KEY` | Privileged server-side Supabase access; keep secret |
| `NEXT_PUBLIC_SITE_URL` | Public base URL used to build links in emails |
| `RESEND_API_KEY` | Resend API key for transactional email |
| `EMAIL_FROM` | Verified sender address used by Resend |
| `CRON_SECRET` | Secret used to authorize scheduled reminder requests |

Email delivery requires a working Resend API key and a sender address verified with Resend. Without email configuration, customers can still use the confirmation page and appointment management link provided by the application.

### Scheduled reminders

`vercel.json` configures Vercel Cron to call `/api/cron/reminders` once per hour. Set `CRON_SECRET` in the deployment environment so the endpoint can authenticate scheduled requests. The reminder job selects appointments in the configured window before their start time and uses the business time zone when preparing the notification.

## Useful commands

```bash
npm run dev       # Start the local development server
npm run lint      # Run ESLint
npm test          # Run the Vitest test suite
npm run build     # Create a production build
npm run start     # Start the production server locally
```

## Main routes

| Route | Purpose |
| --- | --- |
| `/` | Product landing page |
| `/signup` and `/login` | Owner authentication |
| `/b/[slug]` | Public booking flow for a business |
| `/b/manage/[token]` | Customer appointment management link |
| `/dashboard/calendar` | Daily and weekly appointment calendar |
| `/dashboard/services` | Service management |
| `/dashboard/staff` | Employee management and working hours |
| `/dashboard/clients` | Client list, appointment history, and notes |
| `/dashboard/analytics` | Business statistics |
| `/dashboard/waitlist` | Waitlist management |
| `/dashboard/embed` | Booking widget setup |
| `/embed/[slug]` | Embeddable public booking page |

## Project structure

```text
src/
├── actions/                 # Server actions for business workflows
├── app/                     # Next.js routes, pages, and API endpoints
│   ├── (auth)/               # Authentication and onboarding
│   ├── api/                  # Availability and scheduled reminder endpoints
│   ├── b/                    # Public booking and appointment management
│   ├── dashboard/            # Business administration pages
│   └── embed/                # Embeddable booking page
├── components/              # Booking, dashboard, form, and UI components
├── lib/
│   ├── email/                # Email delivery and calendar file generation
│   ├── i18n/                 # Locale selection and document translations
│   ├── scheduling/           # Availability, time-zone, and staff assignment logic
│   ├── supabase/             # Supabase client helpers
│   └── waitlist.ts           # Waitlist notification logic
└── types/                   # Shared TypeScript and database types
```

## Security and access

- Supabase Auth handles owner and team member authentication.
- The application uses business membership and roles to scope dashboard access; staff accounts are limited to their own appointments.
- Public booking and appointment-management operations are handled on the server.
- The service role key is intended for server-side use only and must never be exposed to the browser.
- Database row-level security and the appointment overlap constraint are important parts of the access and booking model. Configure them in the Supabase project before using the app with real data.

## Current limitations

- Revenue analytics are estimates based on completed appointments and service prices; the application does not process or record payments.
- Email delivery depends on external Resend configuration and a verified sender address.
- The application expects its Supabase database schema and access policies to be configured in the connected project.

## License

No license has been added yet. Add a `LICENSE` file before redistributing this project under an open-source license.
