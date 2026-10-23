"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type FormState = { error?: string; message?: string };

const credentialsSchema = z.object({
  email: z.email("Unesi ispravnu email adresu.").transform((email) => email.trim().toLowerCase()),
  password: z.string().min(8, "Lozinka mora imati najmanje 8 karaktera."),
});

export async function signUp(_previousState: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri unete podatke." };

  const supabase = await createSupabaseServerClient();
  const { data, error } = await supabase.auth.signUp({
    ...parsed.data,
    options: { emailRedirectTo: `${getAppUrl()}/auth/callback` },
  });

  if (error) return { error: "Registracija nije uspela. Proveri podatke i pokušaj ponovo." };
  if (data.session) redirect("/onboarding");

  // Kada je potvrda emaila uključena, korisnik prvo potvrđuje adresu.
  return { message: "Poslali smo ti link za potvrdu email adrese. Nakon potvrde prijavi se da nastaviš." };
}

export async function signIn(_previousState: FormState, formData: FormData): Promise<FormState> {
  const parsed = credentialsSchema.safeParse({
    email: formData.get("email"),
    password: formData.get("password"),
  });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri unete podatke." };

  const supabase = await createSupabaseServerClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) return { error: "Email ili lozinka nisu ispravni." };
  redirect("/dashboard");
}

export async function signOut() {
  const supabase = await createSupabaseServerClient();
  await supabase.auth.signOut();
  redirect("/login");
}

export async function createBusiness(_previousState: FormState, formData: FormData): Promise<FormState> {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const name = String(formData.get("name") ?? "").trim();
  const rawSlug = String(formData.get("slug") ?? "").trim();
  const slug = normalizeSlug(rawSlug || name);
  const parsed = z.object({
    name: z.string().min(2, "Naziv mora imati najmanje 2 karaktera.").max(100),
    slug: z.string().min(3, "Slug mora imati najmanje 3 karaktera.").max(40)
      .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Slug koristi mala slova, brojeve i crtice."),
  }).safeParse({ name, slug });

  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri naziv i adresu." };

  // Proveravamo članstvo pre kreiranja, da jedan nalog ne napravi dupli onboarding.
  const { data: existingMembership } = await supabase
    .from("business_members")
    .select("business_id")
    .eq("user_id", user.id)
    .limit(1)
    .maybeSingle();
  if (existingMembership) redirect("/dashboard");

  const { data: business, error: businessError } = await supabase
    .from("businesses")
    .insert({ name: parsed.data.name, slug: parsed.data.slug })
    .select("id")
    .single();

  if (businessError || !business) {
    if (businessError?.code === "23505") return { error: "Ova adresa je zauzeta. Izaberi drugu." };
    return { error: "Nismo uspeli da napravimo poslovni prostor. Pokušaj ponovo." };
  }

  // Schema.sql predviđa service role za upis prvog owner člana.
  const admin = createSupabaseAdminClient();
  const { error: memberError } = await admin.from("business_members").insert({
    business_id: business.id,
    user_id: user.id,
    role: "owner",
  });

  if (memberError) {
    // Uklanjamo prazan business ako upis početnog vlasnika nije uspeo.
    await admin.from("businesses").delete().eq("id", business.id);
    return { error: "Poslovni prostor je napravljen, ali povezivanje vlasnika nije uspelo. Pokušaj ponovo." };
  }

  redirect("/dashboard");
}

function normalizeSlug(value: string) {
  return value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40)
    .replace(/-$/g, "");
}

function getAppUrl() {
  return process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
}
