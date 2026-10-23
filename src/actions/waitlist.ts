"use server";

import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { revalidatePath } from "next/cache";
import { addDaysToDateKey, assertValidDateKey } from "@/lib/scheduling/time";

export type WaitlistState = { error?: string; success?: boolean; message?: string };
const schema = z.object({
  slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
  serviceId: z.uuid(), staffId: z.union([z.literal("any"), z.uuid()]),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  name: z.string().trim().min(2).max(120), email: z.email().transform((value) => value.trim().toLowerCase()),
  phone: z.string().trim().max(40), website: z.string().max(0).optional(),
});

export async function joinWaitlist(_previous: WaitlistState, formData: FormData): Promise<WaitlistState> {
  const parsed = schema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: "Proveri ime, email i datum." };
  const admin = createSupabaseAdminClient();
  const { data: business } = await admin.from("businesses").select("id, timezone, max_days_ahead").eq("slug", parsed.data.slug).maybeSingle();
  if (!business) return { error: "Poslovni prostor nije pronađen." };
  const { data: service } = await admin.from("services").select("id").eq("id", parsed.data.serviceId).eq("business_id", business.id).eq("active", true).maybeSingle();
  if (!service) return { error: "Usluga nije pronađena." };
  try { assertValidDateKey(parsed.data.date); } catch { return { error: "Datum nije ispravan." }; }
  const today = new Intl.DateTimeFormat("sv-SE", { timeZone: business.timezone }).format(new Date());
  const lastDate = addDaysToDateKey(today, business.max_days_ahead);
  if (parsed.data.date < today || parsed.data.date > lastDate) return { error: "Datum je van perioda za zakazivanje." };
  const preferredStaffId = parsed.data.staffId === "any" ? null : parsed.data.staffId;
  if (preferredStaffId) {
    const { data: staff } = await admin.from("staff").select("id").eq("id", preferredStaffId).eq("business_id", business.id).eq("active", true).maybeSingle();
    if (!staff) return { error: "Zaposleni ne pripada ovom salonu." };
    const { data: link } = await admin.from("staff_services").select("staff_id").eq("staff_id", preferredStaffId).eq("service_id", parsed.data.serviceId).maybeSingle();
    if (!link) return { error: "Zaposleni ne radi izabranu uslugu." };
  }
  const { error } = await admin.from("waitlist_entries").insert({
    business_id: business.id, service_id: parsed.data.serviceId, preferred_staff_id: preferredStaffId,
    preferred_date: parsed.data.date, full_name: parsed.data.name, email: parsed.data.email, phone: parsed.data.phone || null,
  });
  if (error) return { error: "Prijava na listu čekanja nije uspela. Pokušaj ponovo." };
  return { success: true, message: "Dodat/a si na listu čekanja. Javićemo ti ako se termin oslobodi." };
}

export async function removeWaitlistEntry(formData: FormData) {
  const entryId = z.uuid().safeParse(formData.get("entryId"));
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!entryId.success || !user) return;
  const { data: member } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member || (member.role !== "owner" && member.role !== "admin")) return;
  await createSupabaseAdminClient().from("waitlist_entries").delete().eq("id", entryId.data).eq("business_id", member.business_id);
  revalidatePath("/dashboard/waitlist");
}
