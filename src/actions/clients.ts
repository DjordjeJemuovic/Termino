"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type ClientNoteState = { error?: string; success?: boolean };

export async function saveClientNotes(_previous: ClientNoteState, formData: FormData): Promise<ClientNoteState> {
  const parsed = z.object({ clientId: z.uuid(), notes: z.string().trim().max(2000) }).safeParse({
    clientId: formData.get("clientId"), notes: formData.get("notes"),
  });
  if (!parsed.success) return { error: "Beleška je predugačka ili zahtev nije ispravan." };
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: "Prijavi se ponovo." };
  const { data: membership } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || (membership.role !== "owner" && membership.role !== "admin")) return { error: "Nemaš dozvolu za izmenu beleški." };
  const admin = createSupabaseAdminClient();
  const { error } = await admin.from("clients").update({ notes: parsed.data.notes || null })
    .eq("id", parsed.data.clientId).eq("business_id", membership.business_id);
  if (error) return { error: "Beleška nije mogla da se sačuva." };
  revalidatePath("/dashboard/clients");
  return { success: true };
}
