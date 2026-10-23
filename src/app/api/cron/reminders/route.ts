import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { sendAppointmentEmail } from "@/lib/email/send";

export async function GET(request: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return NextResponse.json({ error: "Cron nije konfigurisan." }, { status: 503 });
  if (request.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Neovlašćen zahtev." }, { status: 401 });
  }
  if (!process.env.RESEND_API_KEY || !process.env.EMAIL_FROM) {
    return NextResponse.json({ error: "Email servis nije konfigurisan." }, { status: 503 });
  }

  const admin = createSupabaseAdminClient();
  const now = new Date();
  const windowStart = new Date(now.getTime() + 23 * 60 * 60_000);
  const windowEnd = new Date(now.getTime() + 24 * 60 * 60_000);
  const { data: appointments, error } = await admin.from("appointments")
    .select("id, business_id, staff_id, service_id, client_id, starts_at, cancel_token")
    .eq("status", "confirmed").is("reminder_sent_at", null)
    .gt("starts_at", windowStart.toISOString()).lte("starts_at", windowEnd.toISOString())
    .order("starts_at").limit(1000);
  if (error) return NextResponse.json({ error: "Termini za podsetnik nisu mogli da se učitaju." }, { status: 500 });

  let sent = 0;
  let failed = 0;
  let skipped = 0;
  for (const appointment of appointments ?? []) {
    // Claim atomarno pre slanja, da dva cron poziva ne pošalju isti podsetnik.
    const { data: claimed } = await admin.from("appointments").update({ reminder_sent_at: now.toISOString() })
      .eq("id", appointment.id).is("reminder_sent_at", null).select("id").maybeSingle();
    if (!claimed) continue;

    const [{ data: business }, { data: service }, { data: staff }, { data: client }] = await Promise.all([
      admin.from("businesses").select("name, slug, timezone").eq("id", appointment.business_id).single(),
      admin.from("services").select("name, duration_minutes").eq("id", appointment.service_id).single(),
      admin.from("staff").select("name").eq("id", appointment.staff_id).single(),
      admin.from("clients").select("full_name, email").eq("id", appointment.client_id).single(),
    ]);

    // Klijenti bez emaila ne mogu dobiti podsetnik; zadržimo claim da ih ne obrađujemo svaki sat.
    if (client && !client.email) {
      skipped += 1;
      continue;
    }

    const startsAt = new Date(appointment.starts_at);
    const sentEmail = business && service && staff && client?.email
      ? await sendAppointmentEmail({
          id: appointment.id,
          customerName: client.full_name,
          customerEmail: client.email,
          serviceName: service.name,
          staffName: staff.name,
          businessName: business.name,
          startsAt: appointment.starts_at,
          endsAt: new Date(startsAt.getTime() + service.duration_minutes * 60_000).toISOString(),
          timezone: business.timezone,
          manageUrl: process.env.NEXT_PUBLIC_SITE_URL
            ? `${process.env.NEXT_PUBLIC_SITE_URL.replace(/\/$/, "")}/b/manage/${appointment.cancel_token}`
            : undefined,
        }, "reminder")
      : false;

    if (sentEmail) {
      sent += 1;
    } else {
      failed += 1;
      // Neuspešno slanje vraća termin u red da sledeći cron pokušaj može da ga obradi.
      await admin.from("appointments").update({ reminder_sent_at: null })
        .eq("id", appointment.id).eq("reminder_sent_at", now.toISOString());
    }
  }

  return NextResponse.json({ sent, failed, skipped, checked: appointments?.length ?? 0 });
}
