"use client";

import { useEffect, useRef } from "react";
import { usePathname } from "next/navigation";
import { fbq } from "@/lib/pixel";

type TrackingWindow = Window & { __noTrack?: boolean; __noTrackPath?: RegExp };

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
    // The pixel wasn't started on a page holding a one-time link (root
    // layout), and such a page is never reported
    if (w.__noTrack || w.__noTrackPath?.test(pathname)) return;
    fbq("track", "PageView");
  }, [pathname]);

  return null;
}
