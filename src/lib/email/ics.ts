export type IcsEvent = { id: string; title: string; description?: string; startsAt: string; endsAt: string };

function escapeIcsText(value: string) {
  return value.replace(/\\/g, "\\\\").replace(/\r?\n/g, "\\n").replace(/,/g, "\\,").replace(/;/g, "\\;");
}

function formatUtc(value: string) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function createIcsCalendar(event: IcsEvent) {
  const lines = [
    "BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Termino//Booking//SR", "CALSCALE:GREGORIAN", "METHOD:PUBLISH",
    "BEGIN:VEVENT", `UID:${event.id}@termino`, `DTSTAMP:${formatUtc(new Date().toISOString())}`,
    `DTSTART:${formatUtc(event.startsAt)}`, `DTEND:${formatUtc(event.endsAt)}`,
    `SUMMARY:${escapeIcsText(event.title)}`,
    ...(event.description ? [`DESCRIPTION:${escapeIcsText(event.description)}`] : []),
    "END:VEVENT", "END:VCALENDAR",
  ];
  return `${lines.join("\r\n")}\r\n`;
}
