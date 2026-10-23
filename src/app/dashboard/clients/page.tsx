import Link from "next/link";
import { redirect } from "next/navigation";
import { connection } from "next/server";
import { ClientNotesForm } from "@/components/dashboard/client-notes-form";
import { AppointmentStatus } from "@/components/ui/appointment-status";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function ClientsPage({ searchParams }: { searchParams: Promise<{ q?: string | string[] }> }) {
  await connection();
  const query = await searchParams;
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/onboarding");
  if (member.role !== "owner" && member.role !== "admin") redirect("/dashboard");
  const { data: business } = await supabase.from("businesses").select("name, timezone").eq("id", member.business_id).single();
  if (!business) redirect("/dashboard");

  const [{ data: clients, error }, { data: services }, { data: staff }] = await Promise.all([
    supabase.from("clients").select("id, full_name, email, phone, notes, created_at").eq("business_id", member.business_id).order("full_name"),
    supabase.from("services").select("id, name").eq("business_id", member.business_id),
    supabase.from("staff").select("id, name").eq("business_id", member.business_id),
  ]);
  const clientIds = (clients ?? []).map((client) => client.id);
  type ClientHistory = { id: string; client_id: string; service_id: string; staff_id: string; starts_at: string; status: string };
  const historyResult = clientIds.length
    ? await supabase.from("appointments").select("id, client_id, service_id, staff_id, starts_at, status")
      .eq("business_id", member.business_id).in("client_id", clientIds).order("starts_at", { ascending: false })
    : { data: [] as ClientHistory[], error: null };
  const appointments = historyResult.data as ClientHistory[] | null;
  const appointmentsError = historyResult.error;
  const serviceNames = new Map((services ?? []).map((service) => [service.id, service.name]));
  const staffNames = new Map((staff ?? []).map((person) => [person.id, person.name]));
  const historyByClient = new Map<string, NonNullable<typeof appointments>>();
  for (const appointment of appointments ?? []) {
    const history = historyByClient.get(appointment.client_id) ?? [];
    history.push(appointment);
    historyByClient.set(appointment.client_id, history);
  }
  const search = (typeof query.q === "string" ? query.q : "").trim().toLocaleLowerCase("sr-Latn");
  const visibleClients = (clients ?? []).filter((client) =>
    !search || [client.full_name, client.email ?? "", client.phone ?? ""].some((value) => value.toLocaleLowerCase("sr-Latn").includes(search)),
  );
  const formatter = new Intl.DateTimeFormat("sr-Latn-RS", {
    timeZone: business.timezone,
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });

  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#20241f] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard" className="text-sm font-medium text-[#52624f]">← Kontrolna tabla</Link>
      <p className="mt-8 text-sm font-medium text-[#718a70]">{business.name}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em]">Klijenti</h1>
      <form className="mt-5 flex gap-2"><input type="search" name="q" defaultValue={query.q} placeholder="Pretraga imena, emaila ili telefona" className="h-11 flex-1 rounded-xl border border-[#e3e7df] bg-white px-3 text-sm" /><button className="rounded-xl bg-[#365842] px-4 text-sm font-semibold text-white">Traži</button></form>
      {error && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#a34231]">Lista klijenata nije mogla da se učita.</p>}
      {appointmentsError && <p role="alert" className="mt-5 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#a34231]">Istorija termina nije mogla da se učita.</p>}
      {!error && visibleClients.length === 0 && <p className="mt-6 rounded-2xl border border-[#e9ece5] bg-white p-6 text-sm text-[#737c71]">Nema klijenata za prikaz.</p>}

      <div className="mt-6 space-y-4">{visibleClients.map((client) => <article key={client.id} className="rounded-2xl border border-[#e9ece5] bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div><h2 className="font-semibold">{client.full_name}</h2><p className="mt-1 text-sm text-[#737c71]">{client.email || "Bez emaila"}{client.phone ? ` · ${client.phone}` : ""}</p></div>
          <span className="rounded-full bg-[#edf4ea] px-3 py-1 text-xs font-semibold text-[#45634b]">{historyByClient.get(client.id)?.length ?? 0} termina</span>
        </div>
        <ClientNotesForm clientId={client.id} notes={client.notes ?? ""} />
        {(historyByClient.get(client.id)?.length ?? 0) > 0 && <details className="mt-4">
          <summary className="cursor-pointer text-xs font-semibold text-[#52624f]">Istorija termina</summary>
          <ul className="mt-3 space-y-2">{historyByClient.get(client.id)?.map((appointment) => <li key={appointment.id} className="flex flex-wrap justify-between gap-2 rounded-lg bg-[#f7f8f5] px-3 py-2 text-xs">
            <span>{formatter.format(new Date(appointment.starts_at))} · {serviceNames.get(appointment.service_id) ?? "Usluga"} · {staffNames.get(appointment.staff_id) ?? "Zaposleni"}</span>
            <span className="text-[#737c71]"><AppointmentStatus status={appointment.status} /></span>
          </li>)}</ul>
        </details>}
      </article>)}</div>
    </div>
  </main>;
}
