"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { fbq } from "@/lib/pixel";

// Fires PageView on every client-side navigation.
// The initial PageView is handled by the inline script in <head>, so we skip the first mount.
export function MetaPixelRouteTracker() {
  const pathname = usePathname();
  const isFirst = useRef(true);

  useEffect(() => {
    if (isFirst.current) {
      isFirst.current = false;
      return;
    }
    // The pixel wasn't started on a page holding a one-time account link (root layout)
    if ((window as Window & { __noTrack?: boolean }).__noTrack) return;
    fbq("track", "PageView");
  }, [pathname]);

  return null;
}
