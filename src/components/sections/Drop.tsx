import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { pickupWhen, type PickupFields } from "@/lib/pickup";
import { closesLabel, dropPhase, useNow, type DropSchedule } from "@/lib/drop";
import cover from "@/assets/drop-cover.jpg";

type DropRow = PickupFields & DropSchedule & { id: string; title: string };

export default function Drop() {
  const [drop, setDrop] = useState<DropRow | null>(null);
  const [loaded, setLoaded] = useState(!isSupabaseConfigured);
  const now = useNow();
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from("drops").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => { setDrop(data); setLoaded(true); });
  }, []);

  // Hidden until the drop's scheduled start; after it ends the card stays up as sold out.
  const phase = drop ? dropPhase(drop, now) : isSupabaseConfigured ? "upcoming" : "open";
  if (!loaded || phase === "upcoming") return null;

  return (
    <section id="order" className="relative pb-[80px] pt-[80px] md:pb-[128px] md:pt-[96px]">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <h2 className="text-center font-display text-4xl font-black tracking-brand text-primary md:text-6xl">this week's drop.</h2>
        <article className="mx-auto mt-10 max-w-[640px] overflow-hidden rounded-[6px] bg-secondary md:mt-14">
          <img src={cover} alt="multigrain sourdough loaf on a marble board" loading="lazy" className="block h-64 w-full object-cover object-[50%_48%] md:h-80" />
          <div className="px-6 pb-7 pt-6 md:px-8 md:pb-8 md:pt-7">
            <h3 className="font-display text-2xl font-black leading-tight tracking-brand text-primary md:text-3xl">
              {drop?.title?.trim() || "fresh this week."}
            </h3>
            <p className="mt-5 flex items-start gap-2.5 font-mono text-[15px] text-primary/80">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{(drop && pickupWhen(drop)) || "pickup saturday · 9 — 11 am"}</span>
            </p>
            <p className="mt-3 flex items-start gap-2.5 font-mono text-[15px] text-primary/80">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{drop?.pickup_location || "near summit park, maple valley"}</span>
            </p>
            {phase === "open" ? (
              <Link to="/preorder"
                className="mt-7 flex items-center justify-center gap-2 rounded-[6px] bg-primary px-5 py-4 font-mono text-[18px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))]">
                preorder <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            ) : (
              <p aria-disabled="true"
                className="mt-7 flex items-center justify-center rounded-[6px] bg-primary px-5 py-4 font-mono text-[18px] lowercase tracking-brand text-primary-foreground opacity-50">
                {phase === "ended" ? "sold out" : "preorders closed"}
              </p>
            )}
            {phase === "open" && drop?.closes_at && (
              <p className="relative top-[6px] mt-4 flex justify-center">
                <span className="rounded-full bg-background px-4 py-1.5 font-mono text-[13px] lowercase tracking-brand text-primary md:text-[14px]">
                  preorder closes on <span className="font-semibold">{closesLabel(drop.closes_at)}</span>
                </span>
              </p>
            )}
          </div>
        </article>
      </div>
    </section>
  );
}
