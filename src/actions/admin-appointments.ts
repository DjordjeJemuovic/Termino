"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertValidDateKey, getLocalDateKey, localDateTimeToUtc, weekdayFromDateKey } from "@/lib/scheduling/time";
import { sendAppointmentEmail } from "@/lib/email/send";
import { notifyWaitlistForReleasedSlot } from "@/lib/waitlist";

export type AdminActionState = { error?: string; message?: string; success?: boolean };

async function getAdminBusiness() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data: membership } = await session.from("business_members").select("business_id, role")
    .eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) return null;
  const admin = createSupabaseAdminClient();
  const { data: business } = await admin.from("businesses").select("id, name, timezone, min_notice_minutes, max_days_ahead, cancel_window_hours")
    .eq("id", membership.business_id).single();
  return business ? { business, admin } : null;
}

const manualSchema = z.object({
  staffId: z.uuid(), serviceId: z.uuid(), date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/), duration: z.coerce.number().int().min(5).max(600),
  name: z.string().trim().min(2).max(120), email: z.union([z.literal(""), z.email()]),
  phone: z.string().trim().max(40), notes: z.string().trim().max(500),
});

export async function createAdminAppointment(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = manualSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri podatke termina." };
  const context = await getAdminBusiness();
  if (!context) return { error: "Samo vlasnik ili administrator može da dodaje termine." };
  const { business, admin } = context;
  try { assertValidDateKey(parsed.data.date); } catch { return { error: "Izabrani datum nije ispravan." }; }
  const startsAt = localDateTimeToUtc(parsed.data.date, parsed.data.time, business.timezone);
  const endsAt = new Date(startsAt.getTime() + parsed.data.duration * 60_000);
  const weekday = weekdayFromDateKey(parsed.data.date);

  const [{ data: staff }, { data: service }, { data: serviceLink }, { data: hours }, { data: timeOff }, { data: conflicts }] = await Promise.all([
    admin.from("staff").select("id").eq("id", parsed.data.staffId).eq("business_id", business.id).eq("active", true).maybeSingle(),
    admin.from("services").select("id, name, buffer_minutes").eq("id", parsed.data.serviceId).eq("business_id", business.id).eq("active", true).maybeSingle(),
    admin.from("staff_services").select("staff_id").eq("staff_id", parsed.data.staffId).eq("service_id", parsed.data.serviceId).maybeSingle(),
    admin.from("working_hours").select("start_time, end_time").eq("staff_id", parsed.data.staffId).eq("weekday", weekday),
    admin.from("time_off").select("starts_at, ends_at").eq("business_id", business.id).or(`staff_id.is.null,staff_id.eq.${parsed.data.staffId}`)
      .lt("starts_at", new Date(endsAt.getTime() + 120 * 60_000).toISOString()).gt("ends_at", startsAt.toISOString()),
    admin.from("appointments").select("starts_at, ends_at").eq("staff_id", parsed.data.staffId).in("status", ["pending", "confirmed"])
      .lt("starts_at", new Date(endsAt.getTime() + 120 * 60_000).toISOString()).gt("ends_at", startsAt.toISOString()),
  ]);
  if (!staff || !service || !serviceLink) return { error: "Izabrani zaposleni ne radi ovu aktivnu uslugu." };
  const blockedUntil = new Date(endsAt.getTime() + service.buffer_minutes * 60_000);
  if (getLocalDateKey(new Date(blockedUntil.getTime() - 1), business.timezone) !== parsed.data.date) {
    return { error: "Trajanje termina i pauza moraju da stanu u isti radni dan." };
  }
  // Poredimo konkretne trenutke u vremenskoj zoni biznisa, da ne zavisimo
  // od tekstualnog formata sata koji Intl vrati za lokalno vreme.
  const fitsWorkingHours = (hours ?? []).some((interval) => {
    const intervalStart = localDateTimeToUtc(parsed.data.date, interval.start_time.slice(0, 5), business.timezone);
    const intervalEnd = localDateTimeToUtc(parsed.data.date, interval.end_time.slice(0, 5), business.timezone);
    return intervalStart <= startsAt && intervalEnd >= blockedUntil;
  });
  if (!fitsWorkingHours) {
    return { error: "Termin mora da stane u radno vreme zaposlenog." };
  }
  const overlaps = (conflicts ?? []).some((item) => new Date(item.starts_at) < blockedUntil && new Date(item.ends_at) > startsAt);
  const overlapsTimeOff = (timeOff ?? []).some((item) => new Date(item.starts_at) < blockedUntil && new Date(item.ends_at) > startsAt);
  if (overlapsTimeOff || overlaps) return { error: "Zaposleni je zauzet ili odsutan u tom periodu." };

  const { data: client, error: clientError } = await admin.from("clients").upsert({
    business_id: business.id, full_name: parsed.data.name, email: parsed.data.email || null, phone: parsed.data.phone || null,
  }, { onConflict: "business_id,email" }).select("id, email").single();
  if (clientError || !client) return { error: "Klijent nije mogao da se sacuva. Proveri email adresu." };
  const { data: appointment, error } = await admin.from("appointments").insert({
    business_id: business.id, staff_id: staff.id, service_id: service.id, client_id: client.id,
    starts_at: startsAt.toISOString(), ends_at: blockedUntil.toISOString(), status: "confirmed", notes: parsed.data.notes || null,
  }).select("id, cancel_token").single();
  if (error) return { error: error.code === "23P01" ? "Termin je upravo zauzet. Osvezi kalendar i probaj ponovo." : "Termin nije mogao da se sacuva." };
  if (appointment && client.email) {
    const { data: staffDetails } = await admin.from("staff").select("name").eq("id", staff.id).single();
    if (staffDetails) await sendAppointmentEmail({
      id: appointment.id, customerName: parsed.data.name, customerEmail: client.email,
      serviceName: service.name, staffName: staffDetails.name, businessName: business.name,
      startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString(), timezone: business.timezone,
      manageUrl: process.env.NEXT_PUBLIC_SITE_URL
        ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/b/manage/${appointment.cancel_token}`
        : undefined,
    });
  }
  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Termin je dodat u kalendar." };
}

const updateSchema = z.object({ appointmentId: z.uuid(), startsAt: z.iso.datetime({ offset: true }), endsAt: z.iso.datetime({ offset: true }) });

export async function updateAdminAppointment(input: z.infer<typeof updateSchema>): Promise<AdminActionState> {
  const parsed = updateSchema.safeParse(input);
  if (!parsed.success || new Date(parsed.data.endsAt) <= new Date(parsed.data.startsAt)) return { error: "Novo vreme termina nije ispravno." };
  const context = await getAdminBusiness();
  if (!context) return { error: "Nemaš dozvolu za izmenu termina." };
  const { business, admin } = context;
  const { data: appointment } = await admin.from("appointments").select("id, staff_id, service_id, starts_at")
    .eq("id", parsed.data.appointmentId).eq("business_id", business.id).in("status", ["pending", "confirmed"]).maybeSingle();
  if (!appointment) return { error: "Termin nije pronađen ili više nije aktivan." };

  const start = new Date(parsed.data.startsAt);
  const end = new Date(parsed.data.endsAt);
  const date = getLocalDateKey(start, business.timezone);
  const endDate = getLocalDateKey(new Date(end.getTime() - 1), business.timezone);
  const weekday = weekdayFromDateKey(date);
  if (date !== endDate) return { error: "Termin mora da se završi istog dana." };
  const [hoursResult, timeOffResult] = await Promise.all([
    admin.from("working_hours").select("start_time, end_time").eq("staff_id", appointment.staff_id).eq("weekday", weekday),
    admin.from("time_off").select("id").eq("business_id", business.id).or(`staff_id.is.null,staff_id.eq.${appointment.staff_id}`)
      .lt("starts_at", end.toISOString()).gt("ends_at", start.toISOString()),
  ]);
  const startLocal = new Intl.DateTimeFormat("en-GB", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(start);
  const endLocal = new Intl.DateTimeFormat("en-GB", { timeZone: business.timezone, hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(end);
  if (!(hoursResult.data ?? []).some((interval) => interval.start_time.slice(0, 5) <= startLocal && interval.end_time.slice(0, 5) >= endLocal)) {
    return { error: "Termin mora da ostane unutar radnog vremena zaposlenog." };
  }
  if ((timeOffResult.data?.length ?? 0) > 0) return { error: "Termin se preklapa sa odsustvom." };

  // Baza proverava preklapanje atomarno, čak i ako dve izmene stignu istovremeno.
  const { error } = await admin.from("appointments").update({ starts_at: start.toISOString(), ends_at: end.toISOString() })
    .eq("id", appointment.id).eq("business_id", business.id);
  if (error) return { error: error.code === "23P01" ? "Termin se preklapa sa drugim zakazivanjem." : "Izmena termina nije uspela." };
  if (appointment.starts_at !== start.toISOString()) await notifyWaitlistForReleasedSlot({ businessId: business.id, staffId: appointment.staff_id, serviceId: appointment.service_id, startsAt: appointment.starts_at });
  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Termin je pomeren." };
}

const rulesSchema = z.object({ minNotice: z.coerce.number().int().min(0).max(525600), maxDaysAhead: z.coerce.number().int().min(1).max(365), cancelWindow: z.coerce.number().int().min(0).max(8760) });

export async function saveBusinessRules(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = rulesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Unesi ispravne vrednosti pravila zakazivanja." };
  const context = await getAdminBusiness();
  if (!context) return { error: "Nemaš dozvolu za podešavanje pravila." };
  const { error } = await context.admin.from("businesses").update({
    min_notice_minutes: parsed.data.minNotice, max_days_ahead: parsed.data.maxDaysAhead, cancel_window_hours: parsed.data.cancelWindow,
  }).eq("id", context.business.id);
  if (error) return { error: "Pravila nisu mogla da se sačuvaju." };
  revalidatePath("/dashboard/settings");
  return { success: true, message: "Pravila zakazivanja su sačuvana." };
}
