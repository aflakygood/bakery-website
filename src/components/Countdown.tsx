import { useEffect, useState } from "react";
import { cn } from "@/lib/utils";
import { countdownLabel } from "@/lib/drop";

// Ticks every second on its own, so the rest of the page doesn't re-render.
export default function Countdown({ to, className }: { to: string; className?: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const label = countdownLabel(Date.parse(to) - now);
  if (!label) return null;
  return (
    <span role="timer" aria-label={`preorder closes in ${label}`} className={cn("inline-flex items-center rounded-full px-3 py-1.5 font-mono text-[11px] lowercase tracking-brand tabular-nums", className)}>
      closes in <span className="ml-1 font-semibold">{label}</span>
    </span>
  );
}
