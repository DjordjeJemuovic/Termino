import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Plus, UsersRound } from "lucide-react";
import { toggleStaff } from "@/actions/staff";
import { StaffForm } from "@/components/staff/staff-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function StaffPage() {
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
  if (membership.role !== "owner" && membership.role !== "admin") redirect("/dashboard");

  const [{ data: staff, error: staffError }, { data: services, error: servicesError }] = await Promise.all([
    supabase
      .from("staff")
      .select("id, name, color, active")
      .eq("business_id", membership.business_id)
      .order("sort_order")
      .order("name"),
    supabase
      .from("services")
      .select("id, name")
      .eq("business_id", membership.business_id)
      .order("name"),
  ]);

  const staffIds = (staff ?? []).map((person) => person.id);
  const { data: assignments } = staffIds.length > 0
    ? await supabase.from("staff_services").select("staff_id, service_id").in("staff_id", staffIds)
    : { data: [] };
  const serviceNames = new Map((services ?? []).map((service) => [service.id, service.name]));
  const assignedByStaff = new Map<string, string[]>();
  for (const assignment of assignments ?? []) {
    const current = assignedByStaff.get(assignment.staff_id) ?? [];
    current.push(assignment.service_id);
    assignedByStaff.set(assignment.staff_id, current);
  }

  return (
    <main className="min-h-screen bg-[#f7f8f5] text-[#20241f]">
      <header className="border-b border-[#e9ece5] bg-white">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-5 py-4 sm:px-8">
          <Link href="/dashboard" className="flex items-center gap-2 text-sm font-medium text-[#52624f] hover:text-[#304b36]"><ArrowLeft size={16} /> Kontrolna tabla</Link>
          <span className="text-sm text-[#737c71]">{user.email}</span>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-5 py-9 sm:px-8 sm:py-12">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <p className="text-sm font-medium text-[#718a70]">Podešavanje biznisa</p>
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Zaposleni</h1>
            <p className="mt-2 text-sm leading-6 text-[#737c71]">Uredi članove tima, boje u kalendaru i usluge koje obavljaju.</p>
          </div>
          <a href="#novi-zaposleni" className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#365842] px-4 text-sm font-semibold text-white transition hover:bg-[#294a34] sm:self-auto"><Plus size={17} /> Dodaj zaposlenog</a>
        </div>

        {(staffError || servicesError) && <p role="alert" className="mt-6 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#a34231]">Podaci nisu učitani. Osveži stranicu i pokušaj ponovo.</p>}

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4" aria-label="Lista zaposlenih">
            {!staffError && staff?.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#d9dfd5] bg-white px-6 py-12 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#557454]"><UsersRound size={21} /></span>
                <h2 className="mt-4 font-semibold">Još nema zaposlenih</h2>
                <p className="mt-1 text-sm text-[#7b8379]">Dodaj članove tima i izaberi koje usluge rade.</p>
              </div>
            )}

            {staff?.map((person) => {
              const serviceIds = assignedByStaff.get(person.id) ?? [];
              return (
                <article key={person.id} className={`rounded-2xl border bg-white p-5 sm:p-6 ${person.active ? "border-[#e9ece5]" : "border-[#eceee8] opacity-75"}`}>
                  <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                      <span aria-label={`Boja ${person.name}`} className="size-10 rounded-xl border border-black/5" style={{ backgroundColor: person.color }} />
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold tracking-tight">{person.name}</h2>
                          <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${person.active ? "bg-[#edf4ea] text-[#557454]" : "bg-[#f1f2ef] text-[#7b8379]"}`}>{person.active ? "Aktivan" : "Neaktivan"}</span>
                        </div>
                        <p className="mt-1 text-xs text-[#7b8379]">{serviceIds.length ? serviceIds.map((id) => serviceNames.get(id)).filter(Boolean).join(", ") : "Nema dodeljenih usluga"}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Link href={`/dashboard/staff/${person.id}/hours`} className="rounded-full border border-[#e3e7df] px-3 py-2 text-xs font-medium text-[#52624f] transition hover:bg-[#f7f8f5]">Radno vreme</Link>
                      <form action={toggleStaff}>
                        <input type="hidden" name="staffId" value={person.id} />
                        <button className="rounded-full border border-[#e3e7df] px-3 py-2 text-xs font-medium text-[#52624f] transition hover:bg-[#f7f8f5]">{person.active ? "Deaktiviraj" : "Aktiviraj"}</button>
                      </form>
                    </div>
                  </div>
                  <details className="group border-t border-[#eff0eb] pt-4">
                    <summary className="cursor-pointer list-none text-xs font-semibold text-[#60725e] marker:hidden">Izmeni zaposlenog <span className="float-right transition group-open:rotate-180">⌄</span></summary>
                    <div className="pt-4"><StaffForm services={services ?? []} staff={{ ...person, serviceIds }} compact /></div>
                  </details>
                </article>
              );
            })}
          </section>

          <aside id="novi-zaposleni" className="scroll-mt-6 rounded-2xl border border-[#e9ece5] bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf3e9] text-[#557454]"><Plus size={19} /></span>
              <div><h2 className="font-semibold">Dodaj zaposlenog</h2><p className="mt-1 text-xs leading-5 text-[#7b8379]">Dodeli usluge kako bi se kasnije prikazivali tačni termini.</p></div>
            </div>
            <StaffForm services={services ?? []} />
          </aside>
        </div>
      </div>
    </main>
  );
}
