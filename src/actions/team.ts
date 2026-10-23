"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseAdminClient } from "@/lib/supabase/admin";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type TeamActionState = { error?: string; message?: string; success?: boolean };

const invitationSchema = z.object({
  email: z.email().transform((email) => email.trim().toLowerCase()),
  role: z.enum(["admin", "staff"]),
  staffId: z.union([z.literal(""), z.uuid()]),
});

export async function inviteTeamMember(_previous: TeamActionState, formData: FormData): Promise<TeamActionState> {
  const parsed = invitationSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Proveri email, ulogu i zaposlenog." };
  if (parsed.data.role === "staff" && !parsed.data.staffId) return { error: "Za staff nalog izaberi zaposlenog iz tima." };

  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!user) return { error: "Prijavi se pre upravljanja timom." };
  const { data: membership } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || membership.role !== "owner") return { error: "Samo vlasnik može da poziva i menja članove tima." };

  const admin = createSupabaseAdminClient();
  let staffRecord: { id: string; user_id: string | null } | null = null;
  if (parsed.data.staffId) {
    const result = await admin.from("staff").select("id, user_id").eq("id", parsed.data.staffId).eq("business_id", membership.business_id).maybeSingle();
    staffRecord = result.data;
    if (!staffRecord) return { error: "Izabrani zaposleni ne pripada ovom biznisu." };
  }

  const { data: users, error: usersError } = await admin.auth.admin.listUsers({ page: 1, perPage: 1000 });
  if (usersError) return { error: "Nalozi nisu mogli da se provere." };
  let invitedUser = users.users.find((candidate) => candidate.email?.toLowerCase() === parsed.data.email);
  let newlyInvited = false;
  if (!invitedUser) {
    const redirectTo = `${process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"}/auth/callback`;
    const { data, error } = await admin.auth.admin.inviteUserByEmail(parsed.data.email, { redirectTo });
    if (error || !data.user) return { error: "Poziv nije poslat. Proveri email podešavanja u Supabase-u." };
    invitedUser = data.user;
    newlyInvited = true;
  }
  if (staffRecord?.user_id && staffRecord.user_id !== invitedUser.id) {
    return { error: "Ovaj zaposleni je već povezan sa drugim nalogom." };
  }

  const { data: existingMembership } = await admin.from("business_members").select("role")
    .eq("business_id", membership.business_id).eq("user_id", invitedUser.id).maybeSingle();
  if (existingMembership?.role === "owner") return { error: "Vlasnik već ima pristup ovom biznisu." };
  if (staffRecord) {
    const { data: otherStaffLink } = await admin.from("staff").select("id").eq("business_id", membership.business_id)
      .eq("user_id", invitedUser.id).neq("id", staffRecord.id).maybeSingle();
    if (otherStaffLink) return { error: "Ovaj nalog je već povezan sa drugim zaposlenim." };
  }

  if (staffRecord) {
    const { error } = await admin.from("staff").update({ user_id: invitedUser.id }).eq("id", staffRecord.id).eq("business_id", membership.business_id);
    if (error) return { error: "Nalog nije mogao da se poveže sa zaposlenim." };
  }

  const membershipWrite = existingMembership
    ? await admin.from("business_members").update({ role: parsed.data.role }).eq("business_id", membership.business_id).eq("user_id", invitedUser.id)
    : await admin.from("business_members").insert({ business_id: membership.business_id, user_id: invitedUser.id, role: parsed.data.role });
  if (membershipWrite.error) {
    if (staffRecord) await admin.from("staff").update({ user_id: staffRecord.user_id }).eq("id", staffRecord.id).eq("business_id", membership.business_id);
    return { error: "Nalog je pronađen, ali pristup biznisu nije mogao da se sačuva." };
  }

  revalidatePath("/dashboard/team");
  return { success: true, message: newlyInvited ? "Poziv je poslat. Zaposleni može da prihvati email i prijavi se." : "Uloga člana tima je ažurirana." };
}

export async function removeTeamMember(formData: FormData) {
  const targetUserId = z.uuid().safeParse(formData.get("userId"));
  const session = await createSupabaseServerClient();
  const { data: { user } } = await session.auth.getUser();
  if (!targetUserId.success || !user) return;
  const { data: membership } = await session.from("business_members").select("business_id, role").eq("user_id", user.id).limit(1).maybeSingle();
  if (!membership || membership.role !== "owner" || targetUserId.data === user.id) return;

  const admin = createSupabaseAdminClient();
  await admin.from("business_members").delete().eq("business_id", membership.business_id).eq("user_id", targetUserId.data);
  await admin.from("staff").update({ user_id: null }).eq("business_id", membership.business_id).eq("user_id", targetUserId.data);
  revalidatePath("/dashboard/team");
}
