import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { EmbedHeight } from "@/components/booking/embed-height";
import { getPublicBookingOptions, getPublicBusiness } from "@/lib/scheduling/supabase";

export default async function EmbedBookingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; staff?: string; date?: string }> }) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const business = await getPublicBusiness(slug);
  if (!business) notFound();
  const { services, staff } = await getPublicBookingOptions(business.id);
  return <><EmbedHeight /><BookingFlow business={business} services={services} staff={staff} initialSelection={query} /></>;
}
