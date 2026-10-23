"use server";

import { revalidatePath } from "next/cache";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { addDaysToDateKey, getLocalDateKey, localDateTimeToUtc, weekdayFromDateKey } from "@/lib/scheduling/time";

export type DemoState = { error?: string; message?: string; success?: boolean };
const demoServices = [
  { name: "Demo šišanje", duration_minutes: 45, buffer_minutes: 10, price_cents: 250000 },
  { name: "Demo feniranje", duration_minutes: 30, buffer_minutes: 5, price_cents: 150000 },
  { name: "Demo manikir", duration_minutes: 60, buffer_minutes: 10, price_cents: 220000 },
  { name: "Demo tretman lica", duration_minutes: 75, buffer_minutes: 15, price_cents: 390000 },
];
const demoStaff = [
  { name: "Demo Milica", color: "#e87979" },
  { name: "Demo Nikola", color: "#6495ed" },
  { name: "Demo Jelena", color: "#70a77e" },
];

export async function seedDemoData(): Promise<DemoState> {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: "Prijavi se pre demo popunjavanja." };
  const { data: member } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) return { error: "Samo owner ili admin može da popuni demo podatke." };

  const admin = createSupabaseAdminClient();
  const { data: business } = await admin.from("businesses").select("id, timezone").eq("id", member.business_id).single();
  if (!business) return { error: "Biznis nije pronađen." };
  const services: Array<(typeof demoServices)[number] & { id: string }> = [];
  for (const [index, seed] of demoServices.entries()) {
    const { data: existing } = await admin.from("services").select("id, name, duration_minutes, buffer_minutes, price_cents").eq("business_id", business.id).eq("name", seed.name).maybeSingle();
    if (existing) services.push(existing);
    else {
      const { data, error } = await admin.from("services").insert({ ...seed, business_id: business.id, currency: "RSD", active: true, sort_order: index + 1 }).select("id, name, duration_minutes, buffer_minutes, price_cents").single();
      if (error || !data) return { error: "Demo usluge nisu mogle da se dodaju." };
      services.push(data);
    }
  }

  const staff: Array<{ id: string; name: string; color: string }> = [];
  for (const [index, seed] of demoStaff.entries()) {
    const { data: existing } = await admin.from("staff").select("id, name, color").eq("business_id", business.id).eq("name", seed.name).maybeSingle();
    if (existing) staff.push(existing);
    else {
      const { data, error } = await admin.from("staff").insert({ ...seed, business_id: business.id, active: true, sort_order: index + 1 }).select("id, name, color").single();
      if (error || !data) return { error: "Demo zaposleni nisu mogli da se dodaju." };
      staff.push(data);
    }
  }

  for (const [staffIndex, person] of staff.entries()) {
    for (const service of services) {
      const { data: link } = await admin.from("staff_services").select("staff_id").eq("staff_id", person.id).eq("service_id", service.id).maybeSingle();
      if (!link) await admin.from("staff_services").insert({ staff_id: person.id, service_id: service.id });
    }
    const { data: existingHours } = await admin.from("working_hours").select("id").eq("staff_id", person.id).limit(1);
    if (!existingHours?.length) {
      const hours = [0, 1, 2, 3, 4].flatMap((weekday) => [
        { staff_id: person.id, weekday, start_time: "09:00", end_time: "12:00" },
        { staff_id: person.id, weekday, start_time: "13:00", end_time: "17:00" },
      ]);
      hours.push({ staff_id: person.id, weekday: 5, start_time: "10:00", end_time: "14:00" });
      const { error } = await admin.from("working_hours").insert(hours);
      if (error) return { error: "Demo radno vreme nije moglo da se podesi." };
    }
  }

  const names = ["Demo Ana Petrović", "Demo Marko Jovanović", "Demo Sara Nikolić"];
  for (let index = 0; index < 3; index++) {
    const { data: client } = await admin.from("clients").upsert({ business_id: business.id, full_name: names[index], email: `demo-${index + 1}@example.com`, phone: `060000000${index + 1}` }, { onConflict: "business_id,email" }).select("id").single();
    if (!client) continue;
    const { data: previous } = await admin.from("appointments").select("id").eq("business_id", business.id).eq("client_id", client.id).limit(1);
    if (previous?.length) continue;
    const person = staff[index % staff.length];
    const service = services[index % services.length];
    const { data: intervals } = await admin.from("working_hours").select("weekday, start_time, end_time").eq("staff_id", person.id).order("weekday").order("start_time");
    const today = getLocalDateKey(new Date(), business.timezone);
    let created = false;
    for (let offset = 1; offset <= 21 && !created; offset++) {
      const date = addDaysToDateKey(today, offset);
      const weekday = weekdayFromDateKey(date);
      const interval = (intervals ?? []).find((row) => row.weekday === weekday && row.start_time.slice(0, 5) !== "13:00");
      if (!interval) continue;
      const startTime = interval.start_time.slice(0, 5);
      const start = localDateTimeToUtc(date, startTime, business.timezone);
      const endsAt = new Date(start.getTime() + (service.duration_minutes + service.buffer_minutes) * 60_000);
      if (endsAt > localDateTimeToUtc(date, interval.end_time.slice(0, 5), business.timezone)) continue;
      const { data: conflict } = await admin.from("appointments").select("id").eq("staff_id", person.id).in("status", ["pending", "confirmed"]).lt("starts_at", endsAt.toISOString()).gt("ends_at", start.toISOString()).limit(1);
      if (conflict?.length) continue;
      const { error } = await admin.from("appointments").insert({ business_id: business.id, staff_id: person.id, service_id: service.id, client_id: client.id, starts_at: start.toISOString(), ends_at: endsAt.toISOString(), status: "confirmed", notes: "Demo termin" });
      created = !error;
    }
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/calendar");
  revalidatePath("/dashboard/analytics");
  return { success: true, message: "Demo usluge, zaposleni, klijenti i termini su dodati. Ponovnim klikom ne dupliraju se." };
}
