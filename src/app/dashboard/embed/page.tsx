import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function EmbedPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { data: member } = await supabase.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!member) redirect("/onboarding");
  if (member.role !== "owner" && member.role !== "admin") redirect("/dashboard");
  const { data: business } = await supabase.from("businesses").select("name, slug").eq("id", member.business_id).single();
  if (!business) redirect("/dashboard");
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ?? "http://localhost:3000";
  const snippet = `<script src="${baseUrl}/termino-embed.js" data-business="${business.slug}" defer></script>`;
  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#20241f] sm:px-8 sm:py-12"><div className="mx-auto max-w-4xl">
    <Link href="/dashboard" className="text-sm font-medium text-[#52624f]">← Kontrolna tabla</Link>
    <p className="mt-8 text-sm font-medium text-[#718a70]">{business.name}</p><h1 className="mt-1 text-3xl font-semibold">Embed widget</h1>
    <p className="mt-3 max-w-2xl text-sm leading-6 text-[#737c71]">Umetni ovaj kod u HTML stranice salona. Widget prikazuje javni booking flow u prilagodljivom iframe-u.</p>
    <pre className="mt-6 overflow-x-auto rounded-2xl bg-[#202820] p-5 text-sm text-white"><code>{snippet}</code></pre>
    <a href={`/embed/${business.slug}`} target="_blank" className="mt-4 inline-flex rounded-xl bg-[#365842] px-4 py-3 text-sm font-semibold text-white">Pregled widgeta</a>
  </div></main>;
}
