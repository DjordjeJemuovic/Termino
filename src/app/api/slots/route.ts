import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getPublicBusiness, getPublicSlots } from "@/lib/scheduling/supabase";
import { assertValidDateKey } from "@/lib/scheduling/time";

const querySchema = z.object({
  slug: z.string().min(3).max(40).regex(/^[a-z0-9-]+$/),
  serviceId: z.uuid(),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  staffId: z.union([z.literal("any"), z.uuid()]).default("any"),
  excludeAppointmentId: z.uuid().optional(),
});

export async function GET(request: NextRequest) {
  const parsed = querySchema.safeParse(Object.fromEntries(request.nextUrl.searchParams));
  if (!parsed.success) return NextResponse.json({ error: "Proveri izabranu uslugu, datum i zaposlenog." }, { status: 400 });
  try {
    assertValidDateKey(parsed.data.date);
  } catch {
    return NextResponse.json({ error: "Izabrani datum nije ispravan." }, { status: 400 });
  }

  try {
    const business = await getPublicBusiness(parsed.data.slug);
    if (!business) return NextResponse.json({ error: "Poslovni prostor nije pronađen." }, { status: 404 });

    const slots = await getPublicSlots({ business, ...parsed.data });
    return NextResponse.json({ slots }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return NextResponse.json({ error: "Dostupni termini trenutno nisu mogli da se učitaju." }, { status: 500 });
  }
}
