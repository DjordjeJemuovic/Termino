import "server-only";
import { sendWaitlistEmail } from "@/lib/email/send";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { getLocalDateKey } from "@/lib/scheduling/time";

export async function notifyWaitlistForReleasedSlot(input: { businessId: string; staffId: string; serviceId: string; startsAt: string }) {
  const admin = createSupabaseAdminClient();
  const startsAt = new Date(input.startsAt);
  const [{ data: business }, { data: service }] = await Promise.all([
    admin.from("businesses").select("name, slug, timezone").eq("id", input.businessId).single(),
    admin.from("services").select("name").eq("id", input.serviceId).single(),
  ]);
  if (!business || !service) return false;
  const date = getLocalDateKey(startsAt, business.timezone);
  const { data: entries } = await admin.from("waitlist_entries").select("id, full_name, email, preferred_staff_id")
    .eq("business_id", input.businessId).eq("service_id", input.serviceId).eq("preferred_date", date)
    .eq("status", "waiting").order("created_at").limit(20);

  const entry = (entries ?? []).find((candidate) => !candidate.preferred_staff_id || candidate.preferred_staff_id === input.staffId);
  if (!entry) return false;
  const claimTime = new Date().toISOString();
  const { data: claimed } = await admin.from("waitlist_entries").update({ status: "notified", notified_at: claimTime })
    .eq("id", entry.id).eq("status", "waiting").select("id").maybeSingle();
  if (!claimed) return false;

  const site = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  const bookingUrl = `${site ?? ""}/b/${business.slug}?service=${encodeURIComponent(input.serviceId)}&staff=${encodeURIComponent(input.staffId)}&date=${encodeURIComponent(date)}`;
  const sent = await sendWaitlistEmail({ email: entry.email, name: entry.full_name, businessName: business.name, serviceName: service.name, startsAt: input.startsAt, timezone: business.timezone, bookingUrl });
  if (!sent) await admin.from("waitlist_entries").update({ status: "waiting", notified_at: null }).eq("id", entry.id).eq("notified_at", claimTime);
  return sent;
}
