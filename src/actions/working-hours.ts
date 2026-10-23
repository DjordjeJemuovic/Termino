"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/actions/auth";

type Interval = { weekday: number; start_time: string; end_time: string };

export async function saveWorkingHours(_previousState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id, role")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner" && membership.role !== "admin") {
    return { error: "Samo vlasnik ili administrator može menjati radno vreme." };
  }

  const staffId = String(formData.get("staffId") ?? "");
  const { data: staff } = await supabase
    .from("staff")
    .select("id")
    .eq("id", staffId)
    .eq("business_id", membership.business_id)
    .maybeSingle();
  if (!staff) return { error: "Zaposleni nije pronađen." };

  const intervals: Interval[] = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    const starts = formData.getAll(`day_${weekday}_start`).map(String);
    const ends = formData.getAll(`day_${weekday}_end`).map(String);
    if (starts.length !== ends.length) return { error: "Nedostaje vreme početka ili završetka intervala." };
    if (starts.length > 6) return { error: "Možeš dodati najviše 6 intervala za jedan dan." };

    const dayIntervals: Interval[] = [];
    for (let index = 0; index < starts.length; index += 1) {
      const start = starts[index];
      const end = ends[index];
      if (!isTime(start) || !isTime(end)) return { error: "Unesi ispravno vreme za svaki interval." };
      if (start >= end) return { error: "Kraj intervala mora biti posle početka." };
      dayIntervals.push({ weekday, start_time: start, end_time: end });
    }

    // Poređenje HH:MM radi jer su sva vremena u istom lokalnom danu.
    dayIntervals.sort((a, b) => a.start_time.localeCompare(b.start_time));
    for (let index = 1; index < dayIntervals.length; index += 1) {
      if (dayIntervals[index].start_time < dayIntervals[index - 1].end_time) {
        return { error: "Intervali istog dana ne mogu da se preklapaju." };
      }
    }
    intervals.push(...dayIntervals);
  }

  const { data: previousRows, error: readError } = await supabase
    .from("working_hours")
    .select("id")
    .eq("staff_id", staff.id);
  if (readError) return { error: "Postojeće radno vreme nije moglo da se učita." };

  // Prvo upisujemo novi raspored; ako brisanje starog ne uspe, uklanjamo novi upis.
  let insertedIds: string[] = [];
  if (intervals.length > 0) {
    const { data: insertedRows, error: insertError } = await supabase
      .from("working_hours")
      .insert(intervals.map((interval) => ({ ...interval, staff_id: staff.id })))
      .select("id");
    if (insertError || !insertedRows) return { error: "Novi raspored nije sačuvan. Pokušaj ponovo." };
    insertedIds = insertedRows.map((row) => row.id);
  }

  if ((previousRows ?? []).length > 0) {
    const { error: deleteError } = await supabase
      .from("working_hours")
      .delete()
      .eq("staff_id", staff.id);

    if (deleteError) {
      if (insertedIds.length > 0) await supabase.from("working_hours").delete().in("id", insertedIds);
      return { error: "Stari raspored nije mogao da se zameni. Pokušaj ponovo." };
    }
  }

  revalidatePath(`/dashboard/staff/${staff.id}/hours`);
  revalidatePath("/dashboard/staff");
  return { message: "Radno vreme je sačuvano." };
}

function isTime(value: string) {
  if (!/^\d{2}:\d{2}$/.test(value)) return false;
  const [hours, minutes] = value.split(":").map(Number);
  return hours >= 0 && hours <= 23 && minutes >= 0 && minutes <= 59;
}
