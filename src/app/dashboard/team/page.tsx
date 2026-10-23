import Link from "next/link";
import { redirect } from "next/navigation";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { RemoveMemberButton, TeamForm } from "@/components/dashboard/team-form";

export default async function TeamPage() {
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) redirect("/login");
  const { data: membership } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership) redirect("/onboarding");
  if (membership.role !== "owner") redirect("/dashboard");

  const admin = createSupabaseAdminClient();
  const [{ data: business }, { data: members }, { data: staff }, { data: users }] = await Promise.all([
    admin.from("businesses").select("name").eq("id", membership.business_id).single(),
    admin.from("business_members").select("user_id, role").eq("business_id", membership.business_id),
    admin.from("staff").select("id, user_id, name").eq("business_id", membership.business_id).order("name"),
    admin.auth.admin.listUsers({ page: 1, perPage: 1000 }),
  ]);
  if (!business) redirect("/dashboard");
  const emails = new Map((users?.users ?? []).map((account) => [account.id, account.email ?? ""]));
  const staffByUserId = new Map((staff ?? []).filter((person) => person.user_id).map((person) => [person.user_id!, person.name]));

  return <main className="min-h-screen bg-[#f7f8f5] px-5 py-8 text-[#20241f] sm:px-8 sm:py-12">
    <div className="mx-auto max-w-5xl">
      <Link href="/dashboard" className="text-sm font-medium text-[#52624f]">← Kontrolna tabla</Link>
      <p className="mt-8 text-sm font-medium text-[#718a70]">{business.name}</p>
      <h1 className="mt-1 text-3xl font-semibold tracking-[-0.055em]">Članovi i uloge</h1>
      <p className="mt-2 text-sm text-[#737c71]">Vlasnik poziva naloge i povezuje staff nalog sa profilom zaposlenog. Staff vidi samo svoj kalendar.</p>

      <section className="mt-7 rounded-2xl border border-[#e9ece5] bg-white p-6 sm:p-8">
        <h2 className="mb-5 font-semibold">Pozovi člana tima</h2>
        <TeamForm staff={(staff ?? []).map(({ id, name }) => ({ id, name }))} />
      </section>

      <section className="mt-6 rounded-2xl border border-[#e9ece5] bg-white p-6 sm:p-8">
        <h2 className="mb-4 font-semibold">Pristup ovom biznisu</h2>
        <ul className="divide-y divide-[#eef0eb]">{(members ?? []).map((member) => <li key={member.user_id} className="flex flex-wrap items-center justify-between gap-3 py-4">
          <div><p className="text-sm font-semibold">{emails.get(member.user_id) || member.user_id}</p><p className="mt-1 text-xs text-[#737c71]">{member.role}{staffByUserId.has(member.user_id) ? ` · ${staffByUserId.get(member.user_id)}` : ""}</p></div>
          {member.user_id !== user.id && <RemoveMemberButton userId={member.user_id} />}
        </li>)}</ul>
      </section>
    </div>
  </main>;
}
