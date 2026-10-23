import "server-only";
import { getAvailableSlots, type SchedulingStaff, type TimeOff } from "./slots";
import { addDaysToDateKey, assertValidDateKey, localDateTimeToUtc } from "./time";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";

export type PublicBusiness = {
  id: string;
  name: string;
  slug: string;
  timezone: string;
  slot_step_minutes: number;
  min_notice_minutes: number;
  max_days_ahead: number;
};

export type PublicService = {
  id: string;
  name: string;
  description: string | null;
  duration_minutes: number;
  buffer_minutes: number;
  price_cents: number;
  currency: string;
};

export type PublicStaff = { id: string; name: string; color: string; serviceIds: string[] };

export async function getPublicBusiness(slug: string) {
  const admin = createSupabaseAdminClient();
  const { data, error } = await admin
    .from("businesses")
    .select("id, name, slug, timezone, slot_step_minutes, min_notice_minutes, max_days_ahead")
    .eq("slug", slug)
    .maybeSingle();
  if (error) throw new Error("Nismo uspeli da učitamo poslovni prostor.");
  return data as PublicBusiness | null;
}

export async function getPublicBookingOptions(businessId: string) {
  const admin = createSupabaseAdminClient();
  const [{ data: services, error: serviceError }, { data: staff, error: staffError }] = await Promise.all([
    admin.from("services").select("id, name, description, duration_minutes, buffer_minutes, price_cents, currency")
      .eq("business_id", businessId).eq("active", true).order("sort_order").order("name"),
    admin.from("staff").select("id, name, color")
      .eq("business_id", businessId).eq("active", true).order("sort_order").order("name"),
  ]);
  if (serviceError || staffError) throw new Error("Nismo uspeli da učitamo usluge i zaposlene.");

  const staffIds = (staff ?? []).map((person) => person.id);
  const serviceIds = (services ?? []).map((service) => service.id);
  const { data: links, error: linkError } = staffIds.length > 0 && serviceIds.length > 0
    ? await admin.from("staff_services").select("staff_id, service_id")
      .in("staff_id", staffIds).in("service_id", serviceIds)
    : { data: [], error: null };
  if (linkError) throw new Error("Nismo uspeli da učitamo zaposlene za usluge.");

  const staffById = new Map((staff ?? []).map((person) => [person.id, { ...person, serviceIds: [] as string[] }]));
  for (const link of links ?? []) staffById.get(link.staff_id)?.serviceIds.push(link.service_id);

  return {
    services: (services ?? []) as PublicService[],
    staff: [...staffById.values()] as PublicStaff[],
  };
}

export async function getPublicSlots({
  business,
  serviceId,
  date,
  staffId = "any",
  excludeAppointmentId,
  now = new Date(),
}: {
  business: PublicBusiness;
  serviceId: string;
  date: string;
  staffId?: string;
  excludeAppointmentId?: string;
  now?: Date;
}) {
  assertValidDateKey(date);
  const admin = createSupabaseAdminClient();
  const { data: service, error: serviceError } = await admin
    .from("services")
    .select("id, duration_minutes, buffer_minutes")
    .eq("id", serviceId)
    .eq("business_id", business.id)
    .eq("active", true)
    .maybeSingle();
  if (serviceError) throw new Error("Nismo uspeli da učitamo uslugu.");
  if (!service) return [];

  const { data: links, error: linkError } = await admin
    .from("staff_services")
    .select("staff_id")
    .eq("service_id", serviceId);
  if (linkError) throw new Error("Nismo uspeli da učitamo zaposlene za ovu uslugu.");

  const assignedStaffIds = [...new Set((links ?? []).map((link) => link.staff_id))];
  const { data: activeStaff, error: staffError } = await admin
    .from("staff")
    .select("id")
    .eq("business_id", business.id)
    .eq("active", true)
    .in("id", assignedStaffIds.length > 0 ? assignedStaffIds : ["00000000-0000-0000-0000-000000000000"]);
  if (staffError) throw new Error("Nismo uspeli da učitamo zaposlene.");

  const eligibleStaffIds = (activeStaff ?? []).map((person) => person.id);
  const dayStart = localDateTimeToUtc(date, "00:00", business.timezone);
  const dayEnd = localDateTimeToUtc(addDaysToDateKey(date, 1), "00:00", business.timezone);

  let appointmentsQuery = admin.from("appointments").select("id, staff_id, starts_at, ends_at, status")
    .in("staff_id", eligibleStaffIds.length > 0 ? eligibleStaffIds : ["00000000-0000-0000-0000-000000000000"])
    .lt("starts_at", dayEnd.toISOString()).gt("ends_at", dayStart.toISOString());
  if (excludeAppointmentId) appointmentsQuery = appointmentsQuery.neq("id", excludeAppointmentId);

  const [hoursResult, appointmentsResult, timeOffResult] = await Promise.all([
    eligibleStaffIds.length > 0
      ? admin.from("working_hours").select("staff_id, weekday, start_time, end_time").in("staff_id", eligibleStaffIds)
      : Promise.resolve({ data: [], error: null }),
    appointmentsQuery,
    admin.from("time_off").select("staff_id, starts_at, ends_at")
      .eq("business_id", business.id).lt("starts_at", dayEnd.toISOString()).gt("ends_at", dayStart.toISOString()),
  ]);

  if (hoursResult.error || appointmentsResult.error || timeOffResult.error) {
    throw new Error("Nismo uspeli da učitamo raspored.");
  }

  const appointmentsByStaff = new Map<string, SchedulingStaff["appointments"]>();
  for (const appointment of appointmentsResult.data ?? []) {
    const list = appointmentsByStaff.get(appointment.staff_id) ?? [];
    list.push({ startsAt: appointment.starts_at, endsAt: appointment.ends_at, status: appointment.status });
    appointmentsByStaff.set(appointment.staff_id, list);
  }

  const staff: SchedulingStaff[] = (activeStaff ?? []).map((person) => ({
    id: person.id,
    active: true,
    serviceIds: [serviceId],
    workingHours: (hoursResult.data ?? [])
      .filter((interval) => interval.staff_id === person.id)
      .map((interval) => ({
        weekday: interval.weekday,
        startTime: interval.start_time.slice(0, 5),
        endTime: interval.end_time.slice(0, 5),
      })),
    appointments: appointmentsByStaff.get(person.id) ?? [],
  }));

  const timeOff: TimeOff[] = (timeOffResult.data ?? []).map((absence) => ({
    staffId: absence.staff_id,
    startsAt: absence.starts_at,
    endsAt: absence.ends_at,
  }));

  return getAvailableSlots({
    date,
    timeZone: business.timezone,
    serviceId,
    serviceDurationMinutes: service.duration_minutes,
    bufferMinutes: service.buffer_minutes,
    slotStepMinutes: business.slot_step_minutes,
    minNoticeMinutes: business.min_notice_minutes,
    maxDaysAhead: business.max_days_ahead,
    now,
    staffId,
    staff,
    timeOff,
  });
}
