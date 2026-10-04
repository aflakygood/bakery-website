import { motion } from "framer-motion";
import { Calendar, MapPin, ArrowUpRight } from "lucide-react";

export default function Drop() {
  return (
    <section id="order" className="relative pb-[60px] pt-10 md:pb-[108px] md:pt-14">
      <div className="mx-auto max-w-[1100px] px-6 md:px-10">
        <div className="flex flex-col items-center text-center">
          <h2 className="font-display text-4xl font-black tracking-brand text-primary md:text-6xl">
            this week's drop.
          </h2>
        </div>

        <motion.article
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="mt-10 overflow-hidden rounded-md bg-secondary md:mt-14"
        >
          <div className="grid md:grid-cols-2">
            <div className="relative aspect-[4/3] md:aspect-auto md:min-h-[420px]">
              <img
                src="https://images.unsplash.com/photo-1568471173242-461f0a730452?w=1400&q=85&auto=format&fit=crop"
                alt="Featured drop — laminated pastry assortment"
                className="absolute inset-0 h-full w-full object-cover"
                loading="lazy"
              />
              <span className="absolute left-4 top-4 inline-flex items-center gap-2 rounded-full bg-background/90 px-3 py-1.5 font-mono text-[10px] lowercase tracking-brand text-primary backdrop-blur-sm">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                preorders open
              </span>
            </div>

            <div className="flex flex-col justify-between gap-8 p-6 md:p-10">
              <div>
                <p className="font-mono text-[11px] lowercase tracking-brand text-primary/60">vol. 014</p>
                <h3 className="mt-3 font-display text-2xl font-black leading-tight tracking-brand text-primary md:text-4xl">
                  laminated trio + country loaf.
                </h3>
                <p className="mt-4 font-mono text-[13px] leading-relaxed text-primary/75">
                  a curated box for the weekend — classic croissant, pain au chocolat, kouign-amann, and a fresh sourdough country loaf. baked Saturday morning for same-day pickup.
                </p>

                <ul className="mt-6 space-y-3 font-mono text-[12px] text-primary/80">
                  <li className="flex items-start gap-3">
                    <Calendar className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>pickup Saturday · 9 — 11 am</span>
                  </li>
                  <li className="flex items-start gap-3">
                    <MapPin className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                    <span>Maple Valley · address shared via DM</span>
                  </li>
                </ul>
              </div>

              <a
                href="https://instagram.com/"
                target="_blank"
                rel="noreferrer"
                className="group inline-flex items-center justify-between gap-3 rounded-sm bg-primary px-5 py-4 font-mono text-[12px] lowercase tracking-brand text-primary-foreground transition-colors hover:bg-[hsl(var(--green-deep))]"
              >
                <span>dm @aflakygood to reserve</span>
                <ArrowUpRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 group-hover:-translate-y-0.5" />
              </a>
            </div>
          </div>
        </motion.article>
      </div>
    </section>
  );
}