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

// e.g. "8pm friday oct 23" — always Maple Valley time so it reads the same for every visitor.
export function closesLabel(closesAt: string): string {
  const d = new Date(closesAt);
  if (Number.isNaN(d.getTime())) return "";
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-US", { timeZone: "America/Los_Angeles", weekday: "long", month: "short", day: "numeric", hour: "numeric", minute: "2-digit", hour12: true })
      .formatToParts(d).map((p) => [p.type, p.value]),
  );
  const time = `${parts.hour}${parts.minute === "00" ? "" : `:${parts.minute}`}${String(parts.dayPeriod).toLowerCase()}`;
  return `${time} ${parts.weekday} ${parts.month} ${parts.day}`.toLowerCase();
}
