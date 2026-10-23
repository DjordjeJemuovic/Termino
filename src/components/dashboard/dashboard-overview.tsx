"use client";

import Link from "next/link";
import { CalendarDays, Settings2, UsersRound } from "lucide-react";
import { signOut } from "@/actions/auth";
import { DemoDataForm } from "@/components/dashboard/demo-data-form";
import { useLocale } from "@/lib/i18n/locale-provider";

export function DashboardOverview({ role, businessName, slug, email }: { role: string; businessName?: string; slug?: string; email?: string }) {
  const { t } = useLocale();
  const cards = [
    { icon: CalendarDays, title: t("calendar"), text: t("calendarDesc"), href: "/dashboard/calendar", visible: true },
    { icon: Settings2, title: t("services"), text: t("servicesDesc"), href: "/dashboard/services", visible: role !== "staff" },
    { icon: UsersRound, title: t("staff"), text: t("staffDesc"), href: "/dashboard/staff", visible: role !== "staff" },
    { icon: UsersRound, title: t("team"), text: t("teamDesc"), href: "/dashboard/team", visible: role === "owner" },
    { icon: CalendarDays, title: t("clients"), text: t("clientsDesc"), href: "/dashboard/clients", visible: role !== "staff" },
    { icon: CalendarDays, title: t("analytics"), text: t("analyticsDesc"), href: "/dashboard/analytics", visible: role !== "staff" },
    { icon: CalendarDays, title: t("embed"), text: t("embedDesc"), href: "/dashboard/embed", visible: role !== "staff" },
    { icon: CalendarDays, title: t("waitlist"), text: t("waitlistDesc"), href: "/dashboard/waitlist", visible: role !== "staff" },
  ];
  return <main className="min-h-screen bg-[#f7f8f5] text-[#20241f]">
    <header className="border-b border-[#e9ece5] bg-white"><div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
      <Link href="/" className="flex items-center gap-2 text-lg font-semibold tracking-[-0.05em]">◈ termino</Link>
      <div className="flex items-center gap-4 text-sm text-[#737c71]"><span className="hidden sm:inline">{email}</span><form action={signOut}><button className="rounded-full border border-[#e3e7df] px-4 py-2 font-medium">{t("signOut")}</button></form></div>
    </div></header>
    <div className="mx-auto max-w-7xl px-5 py-10 sm:px-8 sm:py-14">
      <p className="text-sm font-medium text-[#718a70]">{t("dashboard")}</p>
      <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">{t("welcome")}{businessName ? ` ${t("welcomeTo")} ${businessName}` : ""}</h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-[#737c71]">{role === "staff" ? t("staffIntro") : t("ownerIntro")}</p>
      <div className="mt-9 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{cards.filter((card) => card.visible).map(({ icon: Icon, title, text, href }) => <section key={href} className="rounded-2xl border border-[#e9ece5] bg-white p-6">
        <span className="flex size-10 items-center justify-center rounded-xl bg-[#edf3e9] text-[#557454]"><Icon size={19} /></span><h2 className="mt-4 font-semibold"><Link href={href} className="hover:text-[#557454]">{title} →</Link></h2><p className="mt-1 text-sm leading-6 text-[#7b8379]">{text}</p>
      </section>)}</div>
      {(role === "owner" || role === "admin") && <DemoDataForm />}
      {slug && <p className="mt-8 text-sm text-[#737c71]">{t("publicAddress")}: <Link className="font-medium text-[#45634b] underline underline-offset-4" href={`/b/${slug}`}>/b/{slug}</Link></p>}
    </div>
  </main>;
}
