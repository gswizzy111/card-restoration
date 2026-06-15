"use client";

import { useState, useEffect } from "react";

const OPEN_TIME = new Date("2026-06-15T03:59:00.000Z"); // 11:59 PM EDT June 14, 2026

function getTimeLeft(): string | null {
  const diff = OPEN_TIME.getTime() - Date.now();
  if (diff <= 0) return null;
  const h = Math.floor(diff / 3600000);
  const m = Math.floor((diff % 3600000) / 60000);
  const s = Math.floor((diff % 60000) / 1000);
  return `${h}:${m.toString().padStart(2, "0")}:${s.toString().padStart(2, "0")}`;
}

export function CountdownTicker() {
  const [timeLeft, setTimeLeft] = useState<string | null>(null);

  useEffect(() => {
    setTimeLeft(getTimeLeft());
    const id = setInterval(() => setTimeLeft(getTimeLeft()), 1000);
    return () => clearInterval(id);
  }, []);

  if (timeLeft === null) return null;

  const segment = `⚡ STORE OPENS IN ${timeLeft} — The Card Doc Shop is back TONIGHT at 11:59 PM EST   ✦`;
  const content = Array(6).fill(segment).join("   ");

  return (
    <div className="w-full bg-[#1a8fe0] text-white overflow-hidden py-2.5 select-none">
      <div className="ticker-track flex whitespace-nowrap">
        <span className="text-sm font-semibold tracking-wide">{content}&nbsp;&nbsp;&nbsp;</span>
        <span className="text-sm font-semibold tracking-wide" aria-hidden>{content}&nbsp;&nbsp;&nbsp;</span>
      </div>
    </div>
  );
}
