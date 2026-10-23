import { notFound } from "next/navigation";
import { ManageAppointment } from "@/components/booking/manage-appointment";
import { AppointmentStatus } from "@/components/ui/appointment-status";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { currentTimeMs, getLocalDateKey } from "@/lib/scheduling/time";

export default async function ManageBookingPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const admin = createSupabaseAdminClient();
  const { data: appointment } = await admin.from("appointments")
    .select("id, business_id, staff_id, service_id, client_id, starts_at, status")
    .eq("cancel_token", token).maybeSingle();
  if (!appointment) notFound();
  const [{ data: business }, { data: service }, { data: staff }] = await Promise.all([
    admin.from("businesses").select("name, slug, timezone, cancel_window_hours").eq("id", appointment.business_id).single(),
    admin.from("services").select("name").eq("id", appointment.service_id).single(),
    admin.from("staff").select("name").eq("id", appointment.staff_id).single(),
  ]);
  if (!business || !service || !staff) notFound();
  const startsAt = new Date(appointment.starts_at);
  const canManage = (appointment.status === "pending" || appointment.status === "confirmed") &&
    startsAt.getTime() - currentTimeMs() >= business.cancel_window_hours * 60 * 60_000;
  const formatter = new Intl.DateTimeFormat("sr-Latn-RS", { timeZone: business.timezone, dateStyle: "full", hour: "2-digit", minute: "2-digit" });

  return <main className="flex min-h-screen items-center justify-center bg-[#fbfaf8] px-5 py-10 text-[#20241f]">
    <section className="w-full max-w-xl rounded-[28px] border border-[#eceee8] bg-white p-7 shadow-[0_20px_70px_rgba(53,66,50,0.08)] sm:p-10">
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718a70]">{business.name}</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em]">Upravljaj terminom</h1>
      <div className="my-6 rounded-2xl bg-[#f7f8f5] p-4 text-sm">
        <p className="font-semibold">{service.name}</p><p className="mt-1 text-[#667064]">{staff.name}</p>
        <p className="mt-1 text-[#667064]">{formatter.format(startsAt)}</p><p className="mt-1 text-xs text-[#899087]">Status: <AppointmentStatus status={appointment.status} /></p>
      </div>
      <ManageAppointment token={token} slug={business.slug} serviceId={appointment.service_id} staffId={appointment.staff_id}
        appointmentId={appointment.id} timezone={business.timezone} initialDate={getLocalDateKey(startsAt, business.timezone)} canManage={canManage} status={appointment.status} />
    </section>
  </main>;
}
