import { TrackForm } from "./track-form";

export default async function TrackPage({
  searchParams,
}: {
  searchParams: Promise<{ order?: string }>;
}) {
  const { order } = await searchParams;
  return <TrackForm initialOrder={order ?? ""} />;
}
