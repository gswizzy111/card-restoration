"use client";

import { useEffect } from "react";
import { fbq } from "@/lib/pixel";

export function PixelViewContent({
  contentName,
  contentCategory,
}: {
  contentName?: string;
  contentCategory?: string;
}) {
  useEffect(() => {
    fbq("track", "ViewContent", {
      content_name: contentName,
      content_category: contentCategory,
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}
