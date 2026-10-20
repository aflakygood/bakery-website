import { useEffect, useState } from "react";

export type DropSchedule = { is_open: boolean; opens_at: string | null; closes_at: string | null };
// upcoming: not started (or not scheduled) · open: taking orders · ended: past closes_at · closed: admin closed it early
export type DropPhase = "upcoming" | "open" | "ended" | "closed";

export function dropPhase(d: DropSchedule, now = Date.now()): DropPhase {
  if (!d.opens_at || now < Date.parse(d.opens_at)) return "upcoming";
  if (d.closes_at && now >= Date.parse(d.closes_at)) return "ended";
  return d.is_open ? "open" : "closed";
}

// Re-renders periodically so a page left open flips to open/sold out at the scheduled time.
export function useNow(intervalMs = 15000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
