"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { FormState } from "@/actions/auth";

async function getStaffContext() {
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

const staffSchema = z.object({
  name: z.string().trim().min(2, "Ime mora imati najmanje 2 karaktera.").max(100, "Ime može imati najviše 100 karaktera."),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Izaberi ispravnu boju."),
  serviceIds: z.array(z.uuid()).max(100, "Možeš izabrati najviše 100 usluga."),
});

export async function saveStaff(_previousState: FormState, formData: FormData): Promise<FormState> {
  const context = await getStaffContext();
  if (!context) return { error: "Samo vlasnik ili administrator može uređivati zaposlene." };

  const parsed = staffSchema.safeParse({
    name: formData.get("name"),
    color: formData.get("color"),
    serviceIds: formData.getAll("serviceIds"),
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri podatke zaposlenog." };

  const staffId = String(formData.get("staffId") ?? "").trim();
  const values = { name: parsed.data.name, color: parsed.data.color };

  // Proveravamo da sve izabrane usluge zaista pripadaju ovom business-u.
  if (parsed.data.serviceIds.length > 0) {
    const { data: validServices, error: serviceError } = await context.supabase
      .from("services")
      .select("id")
      .eq("business_id", context.businessId)
      .in("id", parsed.data.serviceIds);

    if (serviceError || validServices?.length !== new Set(parsed.data.serviceIds).size) {
      return { error: "Neke izabrane usluge nisu dostupne u ovom poslovnom prostoru." };
    }
  }

  if (staffId) {
    const { data: existingStaff } = await context.supabase
      .from("staff")
      .select("id")
      .eq("id", staffId)
      .eq("business_id", context.businessId)
      .maybeSingle();
    if (!existingStaff) return { error: "Zaposleni nije pronađen." };

    const { error } = await context.supabase
      .from("staff")
      .update(values)
      .eq("id", staffId)
      .eq("business_id", context.businessId);
    if (error) return { error: "Izmena zaposlenog nije uspela." };
  } else {
    const { data: createdStaff, error } = await context.supabase
      .from("staff")
      .insert({ ...values, business_id: context.businessId })
      .select("id")
      .single();
    if (error || !createdStaff) return { error: "Zaposleni nije sačuvan. Pokušaj ponovo." };
    formData.set("staffId", createdStaff.id);
  }

  const savedStaffId = String(formData.get("staffId"));

  const { data: currentAssignments, error: assignmentReadError } = await context.supabase
    .from("staff_services")
    .select("service_id")
    .eq("staff_id", savedStaffId);

  if (assignmentReadError) return { error: "Nismo uspeli da učitamo postojeće usluge zaposlenog." };

  const previousIds = new Set((currentAssignments ?? []).map((assignment) => assignment.service_id));
  const nextIds = new Set(parsed.data.serviceIds);
  const idsToAdd = [...nextIds].filter((id) => !previousIds.has(id));
  const idsToRemove = [...previousIds].filter((id) => !nextIds.has(id));

  // Dodajemo nove veze pre uklanjanja starih da izmena ne ostavi zaposlenog bez usluga.
  if (idsToAdd.length > 0) {
    const { error } = await context.supabase.from("staff_services").insert(
      idsToAdd.map((serviceId) => ({ staff_id: savedStaffId, service_id: serviceId })),
    );
    if (error) return { error: "Povezivanje usluga nije uspelo." };
  }

  if (idsToRemove.length > 0) {
    const { error } = await context.supabase
      .from("staff_services")
      .delete()
      .eq("staff_id", savedStaffId)
      .in("service_id", idsToRemove);
    if (error) return { error: "Uklanjanje starih usluga nije uspelo." };
  }

  revalidatePath("/dashboard/staff");
  return { message: staffId ? "Izmene su sačuvane." : "Zaposleni je dodat." };
}

export async function toggleStaff(formData: FormData) {
  const context = await getStaffContext();
  if (!context) return;

  const staffId = String(formData.get("staffId") ?? "");
  const { data: staff } = await context.supabase
    .from("staff")
    .select("active")
    .eq("id", staffId)
    .eq("business_id", context.businessId)
    .maybeSingle();
  if (!staff) return;

  await context.supabase
    .from("staff")
    .update({ active: !staff.active })
    .eq("id", staffId)
    .eq("business_id", context.businessId);

  revalidatePath("/dashboard/staff");
}
