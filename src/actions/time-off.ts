"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { assertValidDateKey, localDateTimeToUtc } from "@/lib/scheduling/time";
import type { AdminActionState } from "@/actions/admin-appointments";

async function getContext() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return null;
  const { data: member } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) return null;
  return { businessId: member.business_id, admin: createSupabaseAdminClient() };
}

const timeOffSchema = z.object({
  staffId: z.union([z.literal("all"), z.uuid()]),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), startTime: z.string().regex(/^\d{2}:\d{2}$/),
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), endTime: z.string().regex(/^\d{2}:\d{2}$/),
  reason: z.string().trim().max(160),
});

export async function createTimeOff(_previous: AdminActionState, formData: FormData): Promise<AdminActionState> {
  const parsed = timeOffSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Proveri datume, vreme i razlog odsustva." };
  const context = await getContext();
  if (!context) return { error: "Samo vlasnik ili administrator može da uređuje odsustva." };
  const { data: business } = await context.admin.from("businesses").select("timezone").eq("id", context.businessId).single();
  if (!business) return { error: "Biznis nije pronađen." };
  let startsAt: Date;
  let endsAt: Date;
  try {
    assertValidDateKey(parsed.data.startDate);
    assertValidDateKey(parsed.data.endDate);
    startsAt = localDateTimeToUtc(parsed.data.startDate, parsed.data.startTime, business.timezone);
    endsAt = localDateTimeToUtc(parsed.data.endDate, parsed.data.endTime, business.timezone);
  } catch {
    return { error: "Datum ili vreme odsustva nije ispravno." };
  }
  if (endsAt <= startsAt) return { error: "Kraj odsustva mora biti posle početka." };
  if (parsed.data.staffId !== "all") {
    const { data: staff } = await context.admin.from("staff").select("id").eq("id", parsed.data.staffId).eq("business_id", context.businessId).maybeSingle();
    if (!staff) return { error: "Zaposleni ne pripada ovom biznisu." };
  }

  // Odsustvo ne može da se unese preko već potvrđenih termina.
  const appointments = context.admin.from("appointments").select("id").eq("business_id", context.businessId)
    .in("status", ["pending", "confirmed"]).lt("starts_at", endsAt.toISOString()).gt("ends_at", startsAt.toISOString());
  const scopedAppointments = parsed.data.staffId === "all" ? appointments : appointments.eq("staff_id", parsed.data.staffId);
  const { data: conflicts, error: conflictError } = await scopedAppointments.limit(1);
  if (conflictError) return { error: "Nije moguće proveriti postojeće termine." };
  if (conflicts?.length) return { error: "U izabranom periodu već postoje zakazani termini. Pomeri ih pre unosa odsustva." };

  const { error } = await context.admin.from("time_off").insert({
    business_id: context.businessId, staff_id: parsed.data.staffId === "all" ? null : parsed.data.staffId,
    starts_at: startsAt.toISOString(), ends_at: endsAt.toISOString(), reason: parsed.data.reason || null,
  });
  if (error) return { error: "Odsustvo nije moglo da se sačuva." };
  revalidatePath("/dashboard/time-off");
  revalidatePath("/dashboard/calendar");
  return { success: true, message: "Odsustvo je dodato." };
}

export async function deleteTimeOff(formData: FormData) {
  const parsed = z.uuid().safeParse(formData.get("timeOffId"));
  const context = await getContext();
  if (!parsed.success || !context) return;
  await context.admin.from("time_off").delete().eq("id", parsed.data).eq("business_id", context.businessId);
  revalidatePath("/dashboard/time-off");
  revalidatePath("/dashboard/calendar");
}
