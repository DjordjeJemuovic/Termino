"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getPublicBusiness, getPublicSlots } from "@/lib/scheduling/supabase";
import { getLocalDateKey } from "@/lib/scheduling/time";
import { revalidatePath } from "next/cache";
import { sendAppointmentEmail } from "@/lib/email/send";
import { notifyWaitlistForReleasedSlot } from "@/lib/waitlist";

export type BookingFormState = { error?: string; message?: string; success?: boolean; managePath?: string };

const bookingSchema = z.object({
  slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
  serviceId: z.uuid(),
  staffId: z.union([z.literal("any"), z.uuid()]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  startsAt: z.iso.datetime({ offset: true }),
  customerName: z.string().trim().min(2, "Unesi ime i prezime.").max(120),
  customerEmail: z.email("Unesi ispravnu email adresu.").transform((email) => email.trim().toLowerCase()),
  customerPhone: z.string().trim().max(40).optional(),
});

export async function createPublicBooking(_previousState: BookingFormState, formData: FormData): Promise<BookingFormState> {
  const parsed = bookingSchema.safeParse({
    slug: formData.get("slug"),
    serviceId: formData.get("serviceId"),
    staffId: formData.get("staffId"),
    date: formData.get("date"),
    startsAt: formData.get("startsAt"),
    customerName: formData.get("customerName"),
    customerEmail: formData.get("customerEmail"),
    customerPhone: formData.get("customerPhone") ?? "",
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri podatke za zakazivanje." };

  try {
    const business = await getPublicBusiness(parsed.data.slug);
    if (!business) return { error: "Poslovni prostor nije pronađen." };
    if (getLocalDateKey(new Date(parsed.data.startsAt), business.timezone) !== parsed.data.date) {
      return { error: "Izabrani datum i termin se ne poklapaju. Izaberi termin ponovo." };
    }

    // Ponovo računamo dostupnost na serveru da stari ili izmenjeni podaci forme ne važe.
    const slots = await getPublicSlots({
      business,
      serviceId: parsed.data.serviceId,
      date: parsed.data.date,
      staffId: parsed.data.staffId,
    });
    const requestedStart = new Date(parsed.data.startsAt).toISOString();
    const selectedSlot = slots.find((slot) => slot.startsAt === requestedStart);
    if (!selectedSlot) return { error: "Ovaj termin više nije dostupan. Izaberi drugi." };

    const admin = createSupabaseAdminClient();
    const { data: client, error: clientError } = await admin
      .from("clients")
      .upsert({
        business_id: business.id,
        full_name: parsed.data.customerName,
        email: parsed.data.customerEmail,
        phone: parsed.data.customerPhone || null,
      }, { onConflict: "business_id,email" })
      .select("id")
      .single();
    if (clientError || !client) return { error: "Kontakt podaci nisu mogli da se sačuvaju. Pokušaj ponovo." };

    for (const staffId of selectedSlot.availableStaffIds) {
      const { data: appointment, error } = await admin.from("appointments").insert({
        business_id: business.id,
        staff_id: staffId,
        service_id: parsed.data.serviceId,
        client_id: client.id,
        starts_at: selectedSlot.startsAt,
        ends_at: selectedSlot.blockedUntil,
        status: "confirmed",
      }).select("id, cancel_token").single();

      if (!error && appointment) {
        const siteUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
        const managePath = `/b/manage/${appointment.cancel_token}`;
        const manageUrl = siteUrl ? `${siteUrl}${managePath}` : undefined;
        const [{ data: service }, { data: staff }] = await Promise.all([
          admin.from("services").select("name").eq("id", parsed.data.serviceId).single(),
          admin.from("staff").select("name").eq("id", staffId).single(),
        ]);
        if (service && staff) {
          await sendAppointmentEmail({
            id: appointment.id,
            customerName: parsed.data.customerName,
            customerEmail: parsed.data.customerEmail,
            serviceName: service.name,
            staffName: staff.name,
            businessName: business.name,
            startsAt: selectedSlot.startsAt,
            endsAt: selectedSlot.serviceEndsAt,
            timezone: business.timezone,
            manageUrl,
          });
        }
        return { success: true, managePath, message: "Termin je uspesno zakazan. Radujemo se tvojoj poseti!" };
      }
      // Exclusion constraint je autoritativna zaštita ako neko drugi potvrdi termin u isto vreme.
      if (error.code !== "23P01") break;
    }

    return { error: "Termin je upravo zauzet. Izaberi neki od preostalih slobodnih termina." };
  } catch {
    return { error: "Zakazivanje trenutno nije uspelo. Pokušaj ponovo za trenutak." };
  }
}

export type ManageAppointmentState = { error?: string; message?: string; success?: boolean };

const manageSchema = z.object({
  token: z.uuid(),
  intent: z.enum(["cancel", "reschedule"]),
  startsAt: z.union([z.literal(""), z.iso.datetime({ offset: true })]),
});

export async function managePublicAppointment(_previous: ManageAppointmentState, formData: FormData): Promise<ManageAppointmentState> {
  const parsed = manageSchema.safeParse({ token: formData.get("token"), intent: formData.get("intent"), startsAt: formData.get("startsAt") ?? "" });
  if (!parsed.success) return { error: "Zahtev nije ispravan." };
  const admin = createSupabaseAdminClient();
  const { data: appointment } = await admin.from("appointments").select("id, business_id, staff_id, service_id, client_id, starts_at, status")
    .eq("cancel_token", parsed.data.token).maybeSingle();
  if (!appointment || (appointment.status !== "pending" && appointment.status !== "confirmed")) return { error: "Ovaj termin više nije moguće menjati." };
  const { data: business } = await admin.from("businesses")
    .select("id, name, slug, timezone, slot_step_minutes, min_notice_minutes, max_days_ahead, cancel_window_hours")
    .eq("id", appointment.business_id).single();
  if (!business) return { error: "Poslovni prostor nije pronađen." };
  const remaining = new Date(appointment.starts_at).getTime() - Date.now();
  if (remaining < business.cancel_window_hours * 60 * 60_000) return { error: "Rok za otkazivanje ili pomeranje je istekao." };

  if (parsed.data.intent === "cancel") {
    const { error } = await admin.from("appointments").update({ status: "cancelled" }).eq("id", appointment.id).eq("cancel_token", parsed.data.token);
    if (error) return { error: "Termin nije mogao da se otkaže." };
    await notifyWaitlistForReleasedSlot({ businessId: appointment.business_id, staffId: appointment.staff_id, serviceId: appointment.service_id, startsAt: appointment.starts_at });
    revalidatePath("/dashboard/calendar");
    return { success: true, message: "Termin je otkazan." };
  }

  if (!parsed.data.startsAt) return { error: "Izaberi novi slobodan termin." };
  const date = getLocalDateKey(new Date(parsed.data.startsAt), business.timezone);
  const slots = await getPublicSlots({ business, serviceId: appointment.service_id, date, staffId: appointment.staff_id, excludeAppointmentId: appointment.id });
  const slot = slots.find((item) => item.startsAt === new Date(parsed.data.startsAt).toISOString());
  if (!slot) return { error: "Izabrani termin više nije dostupan." };
  const { error } = await admin.from("appointments").update({ starts_at: slot.startsAt, ends_at: slot.blockedUntil })
    .eq("id", appointment.id).eq("cancel_token", parsed.data.token);
  if (error) return { error: error.code === "23P01" ? "Termin je upravo zauzet. Izaberi drugi." : "Termin nije mogao da se pomeri." };
  await notifyWaitlistForReleasedSlot({ businessId: appointment.business_id, staffId: appointment.staff_id, serviceId: appointment.service_id, startsAt: appointment.starts_at });
  const [{ data: client }, { data: service }, { data: staff }] = await Promise.all([
    admin.from("clients").select("full_name, email").eq("id", appointment.client_id).single(),
    admin.from("services").select("name, duration_minutes").eq("id", appointment.service_id).single(),
    admin.from("staff").select("name").eq("id", appointment.staff_id).single(),
  ]);
  if (client?.email && service && staff) await sendAppointmentEmail({
    id: appointment.id, customerName: client.full_name, customerEmail: client.email,
    serviceName: service.name, staffName: staff.name, businessName: business.name,
    startsAt: slot.startsAt, endsAt: slot.serviceEndsAt, timezone: business.timezone,
    manageUrl: process.env.NEXT_PUBLIC_SITE_URL
      ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/b/manage/${parsed.data.token}`
      : undefined,
  });
  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Termin je pomeren." };
}
