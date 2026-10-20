export type PickupFields = {
  pickup_info: string;
  pickup_date: string | null;
  pickup_start: string | null;
  pickup_end: string | null;
  pickup_location: string;
};

const parseTime = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return { h, m, pm: h >= 12, h12: h % 12 || 12 };
};

const clock = ({ h12, m }: ReturnType<typeof parseTime>) => (m ? `${h12}:${String(m).padStart(2, "0")}` : `${h12}`);

// "09:00:00", "11:00:00" -> "9-11am"; "11:00", "13:30" -> "11am-1:30pm"
export function formatTimeRange(start: string | null, end: string | null) {
  if (!start) return "";
  const s = parseTime(start);
  if (!end) return `${clock(s)}${s.pm ? "pm" : "am"}`;
  const e = parseTime(end);
  return s.pm === e.pm
    ? `${clock(s)}-${clock(e)}${e.pm ? "pm" : "am"}`
    : `${clock(s)}${s.pm ? "pm" : "am"}-${clock(e)}${e.pm ? "pm" : "am"}`;
}

// "2026-10-24" -> "Saturday Oct 24" (parsed as a local date so it never shifts a day)
export function formatPickupDate(date: string | null) {
  if (!date) return "";
  const [y, m, d] = date.split("-").map(Number);
  const dt = new Date(y, m - 1, d);
  return `${dt.toLocaleDateString("en-US", { weekday: "long" })} ${dt.toLocaleDateString("en-US", { month: "short" })} ${d}`;
}

// Falls back to the free-text pickup_info for drops created before the date/time fields existed.
export function pickupWhen(drop: PickupFields) {
  if (!drop.pickup_date) return drop.pickup_info;
  return ["pickup", formatTimeRange(drop.pickup_start, drop.pickup_end), formatPickupDate(drop.pickup_date)].filter(Boolean).join(" ");
}
