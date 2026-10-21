import { useEffect, useState } from "react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { dropPhase, useNow, type DropPhase, type DropSchedule } from "@/lib/drop";

// Phase of the latest drop (null until loaded), re-evaluated as time passes so a page left open flips at the closing time.
export function useDropPhase(): DropPhase | null {
  const [drop, setDrop] = useState<DropSchedule | null>(null);
  const now = useNow();
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from("drops").select("is_open, opens_at, closes_at").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setDrop(data));
  }, []);
  return drop ? dropPhase(drop, now) : null;
}
