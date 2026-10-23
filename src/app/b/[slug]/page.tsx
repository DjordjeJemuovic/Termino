import { notFound } from "next/navigation";
import { BookingFlow } from "@/components/booking/booking-flow";
import { getPublicBookingOptions, getPublicBusiness } from "@/lib/scheduling/supabase";

export default async function PublicBookingPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ service?: string; staff?: string; date?: string }> }) {
  const { slug } = await params;
  const query = await searchParams;
  const business = await getPublicBusiness(slug);
  if (!business) notFound();

  const { services, staff } = await getPublicBookingOptions(business.id);
  return <BookingFlow business={business} services={services} staff={staff} initialSelection={query} />;
}
