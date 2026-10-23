"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/actions/auth";

const serviceSchema = z.object({
  name: z.string().trim().min(2, "Naziv mora imati najmanje 2 karaktera.").max(100, "Naziv može imati najviše 100 karaktera."),
  duration: z.number().int().min(5, "Trajanje mora biti najmanje 5 minuta.").max(600, "Trajanje može biti najviše 600 minuta."),
  buffer: z.number().int().min(0, "Buffer ne može biti negativan.").max(120, "Buffer može biti najviše 120 minuta."),
  priceCents: z.number().int().min(0, "Cena ne može biti negativna.").max(100_000_000, "Cena je previsoka."),
});

async function getOwnerBusinessId() {
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
  if (membership.role !== "owner" && membership.role !== "admin") return null;

  return { supabase, businessId: membership.business_id };
}

export async function saveService(_previousState: FormState, formData: FormData): Promise<FormState> {
  const context = await getOwnerBusinessId();
  if (!context) return { error: "Samo vlasnik ili administrator može uređivati usluge." };

  const priceInput = String(formData.get("price") ?? "").trim().replace(",", ".");
  const parsed = serviceSchema.safeParse({
    name: formData.get("name"),
    duration: Number(formData.get("duration")),
    buffer: Number(formData.get("buffer")),
    priceCents: /^\d+(?:\.\d{1,2})?$/.test(priceInput) ? Math.round(Number(priceInput) * 100) : Number.NaN,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri podatke usluge." };

  const serviceId = String(formData.get("serviceId") ?? "").trim();
  const values = {
    name: parsed.data.name,
    duration_minutes: parsed.data.duration,
    buffer_minutes: parsed.data.buffer,
    price_cents: parsed.data.priceCents,
  };

  if (serviceId) {
    const { error } = await context.supabase
      .from("services")
      .update(values)
      .eq("id", serviceId)
      .eq("business_id", context.businessId);
    if (error) return { error: "Izmena nije uspela. Pokušaj ponovo." };
  } else {
    const { error } = await context.supabase
      .from("services")
      .insert({ ...values, business_id: context.businessId });
    if (error) return { error: "Usluga nije sačuvana. Pokušaj ponovo." };
  }

  revalidatePath("/dashboard/services");
  return { message: serviceId ? "Izmene su sačuvane." : "Usluga je dodata." };
}

export async function toggleService(formData: FormData) {
  const context = await getOwnerBusinessId();
  if (!context) return;

  const serviceId = String(formData.get("serviceId") ?? "");
  const { data: service } = await context.supabase
    .from("services")
    .select("active")
    .eq("id", serviceId)
    .eq("business_id", context.businessId)
    .maybeSingle();

  if (!service) return;

  await context.supabase
    .from("services")
    .update({ active: !service.active })
    .eq("id", serviceId)
    .eq("business_id", context.businessId);

  revalidatePath("/dashboard/services");
}
