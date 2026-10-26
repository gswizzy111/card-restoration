"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { fbq } from "@/lib/pixel";

type TrackingWindow = Window & { __noTrack?: boolean; __noTrackPath?: RegExp; __startTracking?: () => void };

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
    const w = window as TrackingWindow;
    // Never report a page whose address holds a one-time link (root layout)
    if (w.__noTrackPath?.test(pathname)) return;
    // The visit started on such a page, so analytics and the pixel haven't
    // started yet: start them now that the address no longer holds the token
    if (w.__noTrack) {
      w.__startTracking?.();
      return;
    }
    fbq("track", "PageView");
  }, [pathname]);

  return null;
}
