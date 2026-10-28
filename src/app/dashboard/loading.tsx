import { PageSkeleton } from "@/components/clarity/page-skeleton";

// Instant loading shell — lets <Link> prefetch this route and paint
// immediately on click while the server render streams in.
export default function Loading() {
  return <PageSkeleton variant="overview" />;
}
