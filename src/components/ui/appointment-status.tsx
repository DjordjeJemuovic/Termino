"use client";

import { useLocale } from "@/lib/i18n/locale-provider";

const labels = {
  sr: {
    pending: "Na čekanju",
    confirmed: "Potvrđeno",
    completed: "Završeno",
    cancelled: "Otkazano",
    no_show: "Nije došao/la",
  },
  en: {
    pending: "Pending",
    confirmed: "Confirmed",
    completed: "Completed",
    cancelled: "Cancelled",
    no_show: "No-show",
  },
} as const;

export function AppointmentStatus({ status }: { status: string }) {
  const { locale } = useLocale();
  const translatedStatus = status in labels[locale]
    ? labels[locale][status as keyof (typeof labels)[typeof locale]]
    : status;

  return <span data-no-translate>{translatedStatus}</span>;
}
