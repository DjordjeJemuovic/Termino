import { redirect } from "next/navigation";
import { BusinessForm } from "@/components/auth/auth-form";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export default async function OnboardingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: membership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (membership) redirect("/dashboard");

  return (
    <>
      <p className="text-xs font-semibold uppercase tracking-[0.16em] text-[#718a70]">Još samo jedan korak</p>
      <h1 className="mt-3 text-3xl font-semibold tracking-[-0.055em]">Predstavi svoj biznis</h1>
      <p className="mt-2 text-sm leading-6 text-[#7b8379]">Izaberi ime i kratku adresu koju će klijenti koristiti za zakazivanje.</p>
      <BusinessForm />
    </>
  );
}
