import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Calendar, MapPin, ArrowRight } from "lucide-react";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import cover from "@/assets/gallery/20260427_201323.jpg";

type DropRow = { id: string; title: string; pickup_info: string; is_open: boolean };

export default function Drop() {
  const [drop, setDrop] = useState<DropRow | null>(null);
  useEffect(() => {
    if (!isSupabaseConfigured) return;
    supabase.from("drops").select("*").order("created_at", { ascending: false }).limit(1).maybeSingle()
      .then(({ data }) => setDrop(data));
  }, []);

  return (
    <section id="order" className="relative pb-[60px] pt-10 md:pb-[108px] md:pt-14">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <h2 className="text-center font-display text-4xl font-black tracking-brand text-primary md:text-6xl">this week's drop.</h2>
        <article className="mx-auto mt-10 max-w-[640px] overflow-hidden rounded-[6px] bg-secondary md:mt-14">
          <img src={cover} alt="this week's bake" loading="lazy" className="block h-64 w-full object-cover md:h-80" />
          <div className="px-6 pb-7 pt-6 md:px-8 md:pb-8 md:pt-7">
            <h3 className="font-display text-2xl font-black leading-tight tracking-brand text-primary md:text-3xl">
              Breads and Focaccia
            </h3>
            <p className="mt-5 flex items-start gap-2.5 font-mono text-[13px] text-primary/80">
              <Calendar className="mt-0.5 h-4 w-4 shrink-0" />
              <span>pickup saturday · 9 — 11 am</span>
            </p>
            <p className="mt-3 flex items-start gap-2.5 font-mono text-[13px] text-primary/80">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
              <span>near summit park,&nbsp;maple valley</span>
            </p>
            <Link to="/preorder"
              className="mt-7 flex items-center justify-center gap-2 rounded-sm bg-primary px-5 py-4 font-mono text-[13px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))]">
              click to order <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        </article>
      </div>
    </section>
  );
}
