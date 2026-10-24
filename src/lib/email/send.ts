import "server-only";
import { createIcsCalendar } from "@/lib/email/ics";

export type AppointmentEmailData = {
  id: string;
  customerName: string;
  customerEmail: string;
  serviceName: string;
  staffName: string;
  businessName: string;
  startsAt: string;
  endsAt: string;
  timezone: string;
  manageUrl?: string;
};

function escapeHtml(value: string) {
  return value.replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character] ?? character);
}

function formatAppointmentDate(value: string, timezone: string) {
  return new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: timezone, dateStyle: "full", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
}

export async function sendAppointmentEmail(appointment: AppointmentEmailData) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;

  const title = `Potvrda termina - ${appointment.businessName}`;
  const intro = "Tvoj termin je potvrđen.";
  const manage = appointment.manageUrl
    ? `<p><a href="${escapeHtml(appointment.manageUrl)}">Pomeri ili otkaži termin</a></p>`
    : "";
  const calendar = createIcsCalendar({
    id: appointment.id,
    title: `${appointment.serviceName} - ${appointment.businessName}`,
    description: `Zaposleni: ${appointment.staffName}`,
    startsAt: appointment.startsAt,
    endsAt: appointment.endsAt,
  });

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from,
        to: [appointment.customerEmail],
        subject: title,
        html: `<p>Zdravo ${escapeHtml(appointment.customerName)},</p><p>${intro}</p><p><strong>${escapeHtml(appointment.serviceName)}</strong> kod ${escapeHtml(appointment.staffName)} u ${escapeHtml(appointment.businessName)}.</p><p>${escapeHtml(formatAppointmentDate(appointment.startsAt, appointment.timezone))}</p>${manage}`,
        attachments: [{ filename: "termin.ics", content: Buffer.from(calendar, "utf8").toString("base64"), contentType: "text/calendar; method=PUBLISH" }],
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}

export async function sendWaitlistEmail(input: { email: string; name: string; businessName: string; serviceName: string; startsAt: string; timezone: string; bookingUrl: string }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!apiKey || !from) return false;
  const date = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: input.timezone, dateStyle: "full", hour: "2-digit", minute: "2-digit" }).format(new Date(input.startsAt));
  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", signal: AbortSignal.timeout(8000),
      headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
      body: JSON.stringify({
        from, to: [input.email], subject: `Oslobodio se termin - ${input.businessName}`,
        html: `<p>Zdravo ${escapeHtml(input.name)},</p><p>Oslobodio se termin za uslugu <strong>${escapeHtml(input.serviceName)}</strong> u ${escapeHtml(input.businessName)}.</p><p>${escapeHtml(date)}</p><p><a href="${escapeHtml(input.bookingUrl)}">Pogledaj i rezerviši termin</a></p><p>Termin nije rezervisan dok ne završiš zakazivanje.</p>`,
      }),
    });
    return response.ok;
  } catch {
    return false;
  }
}
