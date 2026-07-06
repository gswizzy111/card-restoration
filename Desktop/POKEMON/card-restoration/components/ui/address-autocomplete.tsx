"use client";

import { useEffect, useRef } from "react";

// Module-level singleton so the Maps script only loads once regardless of
// how many AddressAutocomplete components are mounted simultaneously.
let gmapsResolvers: Array<() => void> = [];
let gmapsLoaded = false;

function loadGoogleMaps(apiKey: string): Promise<void> {
  if (typeof window === "undefined") return Promise.resolve();
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  if ((window as any).google?.maps?.places || gmapsLoaded) return Promise.resolve();

  return new Promise<void>((resolve) => {
    gmapsResolvers.push(resolve);
    if (gmapsResolvers.length > 1) return; // already loading

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (window as any).__googleMapsCallback = () => {
      gmapsLoaded = true;
      gmapsResolvers.forEach((r) => r());
      gmapsResolvers = [];
    };
    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places&callback=__googleMapsCallback`;
    script.async = true;
    document.head.appendChild(script);
  });
}

export interface PlaceFields {
  street1: string;
  city: string;
  state: string;
  zip: string;
  country: string;
}

interface Props {
  id?: string;
  value: string;
  onChange: (value: string) => void;
  onPlaceSelect: (fields: PlaceFields) => void;
  placeholder?: string;
  className?: string;
}

export function AddressAutocomplete({
  id,
  value,
  onChange,
  onPlaceSelect,
  placeholder = "123 Main St",
  className,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  // Keep a stable ref so the autocomplete listener always calls the latest version
  const onPlaceSelectRef = useRef(onPlaceSelect);
  onPlaceSelectRef.current = onPlaceSelect;

  useEffect(() => {
    const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
    if (!apiKey || !inputRef.current) return;

    let destroyed = false;

    loadGoogleMaps(apiKey).then(() => {
      if (destroyed || !inputRef.current) return;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const G = (window as any).google.maps.places;

      const ac = new G.Autocomplete(inputRef.current, {
        types: ["address"],
        componentRestrictions: { country: "us" },
        fields: ["address_components"],
      });

      ac.addListener("place_changed", () => {
        const place = ac.getPlace();
        if (!place.address_components) return;

        let streetNumber = "", route = "", city = "", state = "", zip = "", country = "US";
        for (const c of place.address_components as { types: string[]; long_name: string; short_name: string }[]) {
          if (c.types.includes("street_number"))            streetNumber = c.long_name;
          else if (c.types.includes("route"))              route        = c.long_name;
          else if (c.types.includes("locality") ||
                   c.types.includes("sublocality_level_1")) city        = c.long_name;
          else if (c.types.includes("administrative_area_level_1")) state = c.short_name;
          else if (c.types.includes("postal_code"))        zip          = c.long_name;
          else if (c.types.includes("country"))            country      = c.short_name;
        }

        const street1 = [streetNumber, route].filter(Boolean).join(" ");
        onChange(street1);
        onPlaceSelectRef.current({ street1, city, state, zip, country });
      });
    });

    return () => { destroyed = true; };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <input
      ref={inputRef}
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className={className}
      autoComplete="off"
    />
  );
}
