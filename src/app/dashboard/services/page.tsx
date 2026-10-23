import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, Clock3, Plus, Tag } from "lucide-react";
import { toggleService } from "@/actions/services";
import { ServiceForm } from "@/components/services/service-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

function formatPrice(priceCents: number) {
  return new Intl.NumberFormat("sr-RS", {
    style: "currency",
    currency: "RSD",
    maximumFractionDigits: 0,
  }).format(priceCents / 100);
}

export default async function ServicesPage() {
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

  const { data: services, error } = await supabase
    .from("services")
    .select("id, name, duration_minutes, buffer_minutes, price_cents, active")
    .eq("business_id", membership.business_id)
    .order("sort_order")
    .order("name");

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
            <h1 className="mt-2 text-3xl font-semibold tracking-[-0.055em] sm:text-4xl">Usluge</h1>
            <p className="mt-2 text-sm leading-6 text-[#737c71]">Podesi šta nudiš, koliko traje i koliko košta.</p>
          </div>
          <a href="#nova-usluga" className="inline-flex h-11 items-center justify-center gap-2 self-start rounded-xl bg-[#365842] px-4 text-sm font-semibold text-white transition hover:bg-[#294a34] sm:self-auto"><Plus size={17} /> Nova usluga</a>
        </div>

        {error && <p role="alert" className="mt-6 rounded-xl bg-[#fff0ed] p-4 text-sm text-[#a34231]">Učitavanje usluga nije uspelo. Osveži stranicu i pokušaj ponovo.</p>}

        <div className="mt-8 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="space-y-4" aria-label="Lista usluga">
            {!error && services?.length === 0 && (
              <div className="rounded-2xl border border-dashed border-[#d9dfd5] bg-white px-6 py-12 text-center">
                <span className="mx-auto flex size-12 items-center justify-center rounded-2xl bg-[#edf3e9] text-[#557454]"><Tag size={21} /></span>
                <h2 className="mt-4 font-semibold">Još nema usluga</h2>
                <p className="mt-1 text-sm text-[#7b8379]">Dodaj prvu uslugu da bi je kasnije mogao povezati sa zaposlenima.</p>
              </div>
            )}

            {services?.map((service) => (
              <article key={service.id} className={`rounded-2xl border bg-white p-5 sm:p-6 ${service.active ? "border-[#e9ece5]" : "border-[#eceee8] opacity-75"}`}>
                <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="flex items-center gap-2">
                      <h2 className="font-semibold tracking-tight">{service.name}</h2>
                      <span className={`rounded-full px-2.5 py-1 text-[10px] font-semibold ${service.active ? "bg-[#edf4ea] text-[#557454]" : "bg-[#f1f2ef] text-[#7b8379]"}`}>{service.active ? "Aktivna" : "Neaktivna"}</span>
                    </div>
                    <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#7b8379]">
                      <span className="inline-flex items-center gap-1.5"><Clock3 size={13} /> {service.duration_minutes} min{service.buffer_minutes > 0 ? ` + ${service.buffer_minutes} min buffer` : ""}</span>
                      <span className="inline-flex items-center gap-1.5"><Tag size={13} /> {formatPrice(service.price_cents)}</span>
                    </div>
                  </div>
                  <form action={toggleService}>
                    <input type="hidden" name="serviceId" value={service.id} />
                    <button className="rounded-full border border-[#e3e7df] px-3 py-2 text-xs font-medium text-[#52624f] transition hover:bg-[#f7f8f5]">{service.active ? "Deaktiviraj" : "Aktiviraj"}</button>
                  </form>
                </div>
                <details className="group border-t border-[#eff0eb] pt-4">
                  <summary className="cursor-pointer list-none text-xs font-semibold text-[#60725e] marker:hidden">Izmeni uslugu <span className="float-right transition group-open:rotate-180">⌄</span></summary>
                  <div className="pt-4">
                    <ServiceForm service={service} compact />
                  </div>
                </details>
              </article>
            ))}
          </section>

          <aside id="nova-usluga" className="scroll-mt-6 rounded-2xl border border-[#e9ece5] bg-white p-5 sm:p-6">
            <div className="mb-5 flex items-start gap-3">
              <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#edf3e9] text-[#557454]"><Plus size={19} /></span>
              <div><h2 className="font-semibold">Dodaj uslugu</h2><p className="mt-1 text-xs leading-5 text-[#7b8379]">Usluga će biti aktivna i spremna za povezivanje sa zaposlenima.</p></div>
            </div>
            <ServiceForm />
          </aside>
        </div>
      </div>
    </main>
  );
}
