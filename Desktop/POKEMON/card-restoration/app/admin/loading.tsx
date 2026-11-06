import { Skeleton } from "@/components/ui/skeleton";

// Shown the moment an admin link is clicked, while the page's data loads
export default function AdminLoading() {
  return (
    <div className="min-h-screen bg-secondary/30" aria-busy="true" aria-label="Loading">
      <div className="max-w-6xl mx-auto px-6 py-10">
        <Skeleton className="h-8 w-56 mb-2" />
        <Skeleton className="h-4 w-40 mb-8" />
        <div className="flex flex-col gap-3">
          {Array.from({ length: 5 }, (_, i) => (
            <Skeleton key={i} className="h-24 w-full rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
